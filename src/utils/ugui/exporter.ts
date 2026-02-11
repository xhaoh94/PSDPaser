import type { PsdDocument, PsdLayer } from '../../types/psd';
import type { NamingRules } from '../../stores/configStore';
import type { SpriteInfo } from './types';
import { parseLayerName } from './nameParser';
import { scanMultipleSpriteDirectories } from './spriteResolver';
import { exportImage } from './imageExporter';
import { PrefabGenerator } from './prefabGenerator';

export class UGUIExporter {
  private spriteDirHandle: FileSystemDirectoryHandle;
  private outputDirHandle: FileSystemDirectoryHandle;
  private commonPaths: FileSystemDirectoryHandle[];
  private bigFileDirHandle: FileSystemDirectoryHandle | null;
  private namingRules?: NamingRules;
  private bigFileThreshold: number = 512; // 大图阈值
  private fontDirHandle: FileSystemDirectoryHandle | null = null;
  private fontMap: Map<string, string> = new Map(); // FontName -> GUID
  private overwriteImages: boolean;

  constructor(
    spriteDirHandle: FileSystemDirectoryHandle,
    outputDirHandle: FileSystemDirectoryHandle,
    namingRules?: NamingRules,
    commonPaths?: FileSystemDirectoryHandle[],
    bigFileDirHandle?: FileSystemDirectoryHandle | null,
    bigFileThreshold?: number,
    fontDirHandle?: FileSystemDirectoryHandle | null,
    overwriteImages?: boolean
  ) {
    this.spriteDirHandle = spriteDirHandle;
    this.outputDirHandle = outputDirHandle;
    this.namingRules = namingRules;
    this.overwriteImages = overwriteImages || false;
    this.commonPaths = commonPaths || [];
    this.bigFileDirHandle = bigFileDirHandle || null;
    this.bigFileThreshold = bigFileThreshold || 512;
    this.fontDirHandle = fontDirHandle || null;
  }

  // 验证目录是否仍然存在（用户可能在磁盘上删除了文件夹）
  private async verifyDirectoryExists(handle: FileSystemDirectoryHandle, name: string): Promise<boolean> {
    try {
      // 尝试访问目录内容来验证目录是否存在
      // @ts-ignore
      const entries = handle.values();
      // 只需要尝试获取迭代器，不实际遍历
      // 如果目录被删除，这会立即抛出 NotFoundError
      await entries.next();
      return true;
    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        console.error(`[UGUI] Directory '${name}' no longer exists on disk`);
        return false;
      }
      // 其他错误（如权限错误）我们暂时忽略，让后续操作处理
      return true;
    }
  }

  // 检查文件是否已存在
  private async checkFileExists(fileName: string): Promise<boolean> {
    try {
      await this.outputDirHandle.getFileHandle(fileName);
      return true;
    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        return false;
      }
      throw e;
    }
  }

  // 扫描字体目录，建立 FontName -> GUID 映射
  private async scanFontDirectory() {
    if (!this.fontDirHandle) return;
    console.log('[UGUI] Scanning font directory...');
    this.fontMap.clear();
    
    const traverse = async (handle: FileSystemDirectoryHandle) => {
      try {
        // @ts-ignore
        for await (const entry of handle.values()) {
          if (entry.kind === 'directory') {
            await traverse(entry as FileSystemDirectoryHandle);
          } else if (entry.kind === 'file') {
            const name = entry.name;
            if (/\.(ttf|otf)$/i.test(name)) {
              try {
                // Look for .meta file
                const metaName = `${name}.meta`;
                const metaHandle = await handle.getFileHandle(metaName);
                const metaFile = await metaHandle.getFile();
                const metaContent = await metaFile.text();
                
                // Parse GUID
                const guidMatch = metaContent.match(/guid:\s*([a-f0-9]{32})/i);
                if (guidMatch) {
                  const guid = guidMatch[1];
                  const fontName = name.substring(0, name.lastIndexOf('.'));
                  
                  // Map font name to GUID (store both original and lowercase)
                  this.fontMap.set(fontName, guid);
                  this.fontMap.set(fontName.toLowerCase(), guid);
                  
                  // 去除空格的版本
                  this.fontMap.set(fontName.replace(/\s+/g, ''), guid);
                  this.fontMap.set(fontName.replace(/\s+/g, '').toLowerCase(), guid);
                  
                  console.log(`[UGUI] Found font: ${fontName} -> ${guid}`);
                }
              } catch (e) {
                // Meta not found or error, ignore
              }
            }
          }
        }
      } catch (e) {
        console.warn(`[UGUI] Error traversing font dir:`, e);
      }
    };
    
    await traverse(this.fontDirHandle);
    console.log(`[UGUI] Font scan complete. Found ${this.fontMap.size / 4} unique fonts.`); // divided by variations
  }

  public async export(psd: PsdDocument, viewName: string, onConfirmOverwrite?: () => Promise<boolean>): Promise<void> {
    console.log('[UGUI] Starting export...');
    
    // 验证目录仍然存在
    const spriteDirExists = await this.verifyDirectoryExists(this.spriteDirHandle, 'Sprite');
    const outputDirExists = await this.verifyDirectoryExists(this.outputDirHandle, 'Output');
    
    if (!spriteDirExists) {
      throw new Error('Sprite 资源目录已被删除，请重新选择');
    }
    if (!outputDirExists) {
      throw new Error('Prefab 输出目录已被删除，请重新选择');
    }
    
    // 检查文件是否已存在
    const prefabFileName = `${viewName}.prefab`;
    const fileExists = await this.checkFileExists(prefabFileName);
    
    if (fileExists) {
      console.log(`[UGUI] File ${prefabFileName} already exists`);
      // 如果提供了确认回调，调用它
      if (onConfirmOverwrite) {
        const shouldOverwrite = await onConfirmOverwrite();
        if (!shouldOverwrite) {
          console.log('[UGUI] User cancelled overwrite');
          return; // 用户取消，不抛出错误，只是静默返回
        }
      }
    }
    
    // 扫描字体目录
    await this.scanFontDirectory();
    
    try {
      // 1. Scan existing sprites
      console.log('[UGUI] Scanning sprite directories...');
      const spriteMap = await scanMultipleSpriteDirectories(this.spriteDirHandle, this.commonPaths);
      console.log(`[UGUI] Found ${spriteMap.size} sprites`);

      // 2. Process missing sprites
      console.log('[UGUI] Processing layers for missing sprites...');
      await this.processMissingSprites(psd.layers, spriteMap);
      console.log('[UGUI] Sprite processing complete');

      // 3. Generate Prefab YAML
      console.log('[UGUI] Generating Prefab YAML...');
      const generator = new PrefabGenerator(
        psd.width, 
        psd.height, 
        spriteMap, 
        this.namingRules,
        this.fontMap // 传递字体映射
      );
      const yaml = generator.generate(psd.layers, viewName);
      console.log('[UGUI] YAML generation complete');

      // 4. Write Prefab file
      console.log(`[UGUI] Writing Prefab file: ${viewName}.prefab`);
      const fileHandle = await this.outputDirHandle.getFileHandle(`${viewName}.prefab`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(yaml);
      await writable.close();
      console.log('[UGUI] Export successful!');
    } catch (err) {
      console.error('[UGUI] Export failed:', err);
      throw err;
    }
  }

  private async processMissingSprites(layers: PsdLayer[], map: Map<string, SpriteInfo>) {
    for (const layer of layers) {
      if (!layer.visible) continue;

      const info = parseLayerName(layer.name, layer.type, this.namingRules);
      console.log(`[UGUI] Processing layer: ${layer.name} -> exportName: ${info.exportName}, type: ${info.type}, layerType: ${layer.type}`);
      
      if (info.noExport) {
        console.log(`[UGUI] Skipping noExport layer: ${layer.name}`);
        continue;
      }

      if (layer.children) {
        await this.processMissingSprites(layer.children, map);
      }

      // Group 类型的图层，如果没有 canvas 内容才跳过
      // 如果 Group 有 canvas (例如智能对象或已合并的组)，则视为图片导出
      if (layer.type === 'group' && !layer.canvas) {
        console.log(`[UGUI] Skipping container group layer: ${layer.name}`);
        continue;
      }

      // 增加对 usual_img9_j6 的深度调试
      if (layer.name.includes('usual_img9_j6')) {
        console.log(`[UGUI] DEBUG TARGET LAYER: ${layer.name}`);
        console.log(`- Type: ${layer.type}`);
        console.log(`- Has Canvas: ${!!layer.canvas}`);
        console.log(`- Canvas Size: ${layer.canvas ? `${layer.canvas.width}x${layer.canvas.height}` : 'N/A'}`);
        console.log(`- Children Count: ${layer.children?.length || 0}`);
        console.log(`- Visible: ${layer.visible}`);
        console.log(`- Info Type: ${info.type}`);
        console.log(`- Info ExportName: ${info.exportName}`);
      }

      // Group 类型的图层，如果没有 canvas 内容才跳过
      // 如果 Group 有 canvas (例如智能对象或已合并的组)，则视为图片导出
      if (layer.type === 'group' && !layer.canvas) {
        // Double check: if it's our target layer, log why it's skipped
        if (layer.name.includes('usual_img9_j6')) {
           console.warn(`[UGUI] SKIP TARGET LAYER: ${layer.name} because it is a group without canvas`);
        }
        console.log(`[UGUI] Skipping container group layer: ${layer.name}`);
        continue;
      }

      if (info.type === 'Image') {
        const spriteExists = map.has(info.exportName);
        if (!spriteExists || this.overwriteImages) {
          try {
            // 检查图片尺寸，决定导出到哪个目录
            const layerWidth = layer.bounds.right - layer.bounds.left;
            const layerHeight = layer.bounds.bottom - layer.bounds.top;
            const isBigFile = layerWidth > this.bigFileThreshold || layerHeight > this.bigFileThreshold;
            
            // 决定目标目录：大图使用 bigfile 目录，否则使用主目录
            let targetDir = this.spriteDirHandle;
            if (isBigFile && this.bigFileDirHandle) {
              targetDir = this.bigFileDirHandle;
              console.log(`[UGUI] Big file detected (${layerWidth}x${layerHeight}), exporting to bigfile: ${info.exportName}`);
            } else {
              if (spriteExists) {
                console.log(`[UGUI] Overwriting existing sprite: ${info.exportName}`);
              } else {
                console.log(`[UGUI] Exporting missing sprite: ${info.exportName}`);
              }
            }
            const sprite = await exportImage(layer, targetDir, info.exportName, info.border, info.targetSize);
            if (sprite) {
              map.set(info.exportName, sprite);
              console.log(`[UGUI] Exported sprite: ${info.exportName}, guid: ${sprite.guid}`);
            } else {
              console.warn(`[UGUI] Skipped sprite export for ${info.exportName} (empty content)`);
            }
          } catch (e) {
            console.error(`[UGUI] Failed to export sprite ${info.exportName}:`, e);
          }
        } else {
          // 如果已存在，且未设置覆盖，则复用现有资源
          if (info.exportName.includes('usual_img9_j6')) {
            console.log(`[UGUI] DEBUG: Using existing sprite for ${info.exportName}:`, map.get(info.exportName));
          }
          console.log(`[UGUI] Sprite already exists (reuse): ${info.exportName}`);
        }
      }
    }
  }
}
