import type { PsdDocument, PsdLayer, LayerBounds } from '../../types/psd';
import { parseLayerName } from './nameParser';
import { generatePackageXml, generateComponentXml, parsePackageXml } from './xmlGenerator';
import type { FguiNodeInfo } from './types';
import type { NamingRules } from '../../stores/configStore';
import { LayerRenderer } from './renderer';

// 生成 8 位随机 ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// 资源映射表
interface ResourceMap {
  [layerId: string]: {
    id: string; // FGUI ID
    fileName: string; // 文件名
    packageId: string; // 包 ID (如果是跨包引用)
    width: number;
    height: number;
    path: string; // 存放路径 /Assets/ 或 /
  }
}

interface PackageContext {
  id: string; // 包 ID
  name: string; // 包名
  resources: any[]; // 资源列表
  handle: FileSystemDirectoryHandle; // 目录句柄
}

export class FguiExporter {
  private rootHandle: FileSystemDirectoryHandle;
  private largeImageThreshold: number;
  private resolution: number = 72; // PSD DPI
  private namingRules?: NamingRules;
  private renderer: LayerRenderer;
  private commonPaths: FileSystemDirectoryHandle[] = [];
  private bigFileHandle: FileSystemDirectoryHandle | null = null;
  private commonResources: Map<string, { id: string, packageId: string, width: number, height: number, type: string }> = new Map();
  
  // 上下文
  private currentPackage: PackageContext | null = null;
  private commonPackage: PackageContext | null = null;
  private bigFilePackage: PackageContext | null = null;
  
  // 资源缓存
  private resourceMap: ResourceMap = {};

  constructor(
    rootHandle: FileSystemDirectoryHandle, 
    largeImageThreshold = 512, 
    namingRules?: NamingRules,
    commonPaths: FileSystemDirectoryHandle[] = [],
    bigFileHandle: FileSystemDirectoryHandle | null = null
  ) {
    this.rootHandle = rootHandle;
    this.largeImageThreshold = largeImageThreshold;
    this.namingRules = namingRules;
    this.renderer = new LayerRenderer();
    this.commonPaths = commonPaths;
    this.bigFileHandle = bigFileHandle;
  }

  // 获取子目录句柄 (如果不存在则创建)
  private async getDirectory(parent: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle> {
    return await parent.getDirectoryHandle(name, { create: true });
  }

  // 写入文件
  private async writeFile(dirHandle: FileSystemDirectoryHandle, name: string, content: string | Blob | BufferSource) {
    const fileHandle = await dirHandle.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * 检查指定的界面是否已存在
   */
  public async checkViewExists(packageName: string, viewName: string): Promise<boolean> {
    try {
      const assetsDir = await this.rootHandle.getDirectoryHandle('assets', { create: false });
      const packageDir = await assetsDir.getDirectoryHandle(packageName, { create: false });
      const viewDir = await packageDir.getDirectoryHandle('View', { create: false });
      await viewDir.getFileHandle(`${viewName}.xml`, { create: false });
      return true;
    } catch {
      return false;
    }
  }

  // 初始化包结构
  private async initPackage(name: string): Promise<PackageContext> {
    // 1. 进入 assets 目录
    const assetsDir = await this.getDirectory(this.rootHandle, 'assets');
    // 2. 进入包目录
    const packageDir = await this.getDirectory(assetsDir, name);
    
    // 3. 尝试读取 package.xml 获取 ID 和现有资源
    let id = generateId();
    let existingResources: any[] = [];
    try {
      const fileHandle = await packageDir.getFileHandle('package.xml', { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      
      const parsed = parsePackageXml(text);
      if (parsed.id) id = parsed.id;
      existingResources = parsed.resources;
    } catch {
      // 文件不存在，使用新 ID
    }

    // 4. 创建子目录
    await this.getDirectory(packageDir, 'Component');
    await this.getDirectory(packageDir, 'Assets');
    await this.getDirectory(packageDir, 'View');

    return {
      id,
      name,
      resources: existingResources,
      handle: packageDir
    };
  }

  // 扫描公共包资源
  private async scanCommonPackages() {
    console.log(`[FGUI] Scanning ${this.commonPaths.length} common packages...`);
    this.commonResources.clear();
    
    for (const handle of this.commonPaths) {
      try {
        const packageName = handle.name;
        // 读取 package.xml
        try {
          const fileHandle = await handle.getFileHandle('package.xml', { create: false });
          const file = await fileHandle.getFile();
          const text = await file.text();
          
          const parsed = parsePackageXml(text);
          if (parsed.id && parsed.resources) {
            console.log(`[FGUI] Found common package: ${packageName} (id=${parsed.id}) with ${parsed.resources.length} resources`);
            
            // 建立映射 fileName -> resource info
            for (const res of parsed.resources) {
              if (res.name) {
                // name 通常是 "Assets/xxx.png" 或 "xxx.png"
                const fileName = res.name.split('/').pop() || res.name;
                const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
                
                // 处理 Image 和 Component
                if (res.type === 'image' || res.type === 'component') {
                  // 如果还未记录，记录之（优先使用第一个找到的）
                  if (!this.commonResources.has(nameWithoutExt)) {
                    this.commonResources.set(nameWithoutExt, {
                      id: res.id,
                      packageId: parsed.id,
                      width: res.width || 0,
                      height: res.height || 0,
                      type: res.type
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn(`[FGUI] Failed to read package.xml for common package: ${packageName}`, e);
        }
      } catch (e) {
        console.warn(`[FGUI] Failed to access common package: ${handle.name}`, e);
      }
    }
    console.log(`[FGUI] Scanned common resources map: ${this.commonResources.size} items`);
  }

  // 主导出方法
  public async export(psd: PsdDocument, packageName: string, viewName: string): Promise<void> {
    this.resolution = psd.resolution || 72;

    // 扫描公共包
    await this.scanCommonPackages();

    // 2. 初始化包环境
    this.currentPackage = await this.initPackage(packageName);
    this.commonPackage = await this.initPackage('Common');
    
    // 初始化 BigFile 包 (如果配置了)
    if (this.bigFileHandle) {
      try {
        const fileHandle = await this.bigFileHandle.getFileHandle('package.xml', { create: false });
        const file = await fileHandle.getFile();
        const text = await file.text();
        const parsed = parsePackageXml(text);
        
        this.bigFilePackage = {
          id: parsed.id || generateId(),
          name: this.bigFileHandle.name,
          resources: parsed.resources || [],
          handle: this.bigFileHandle
        };
        console.log(`[FGUI] Initialized BigFile package: ${this.bigFilePackage.name} (${this.bigFilePackage.id})`);
      } catch {
        console.warn(`[FGUI] BigFile package has no package.xml, treating as new package`);
        this.bigFilePackage = {
          id: generateId(),
          name: this.bigFileHandle.name,
          resources: [],
          handle: this.bigFileHandle
        };
      }
    }

    this.resourceMap = {};

    // 3. 预处理图层 (提取图片资源)
    await this.processAssets(psd.layers);

    // 4. 生成组件 (递归)
    await this.processComponents(psd.layers);

    // 5. 生成主界面组件
    await this.generateMainComponent(psd, viewName);

    // 6. 生成所有 package.xml
    await this.savePackageXml(this.currentPackage);
    await this.savePackageXml(this.commonPackage);
    if (this.bigFilePackage) {
      await this.savePackageXml(this.bigFilePackage);
    }
  }

  // 处理资源 (图片)
  private async processAssets(layers: PsdLayer[]) {
    for (const layer of layers) {
      const info = parseLayerName(layer.name, this.namingRules);
      
      // 如果标记为不导出，直接跳过整个分支
      if (info.noExport) continue;

      // 递归子图层
      if (layer.children) {
        await this.processAssets(layer.children);
      }

      // 如果是文本图层，跳过图片导出
      if (layer.textInfo) continue;

      // 如果是图片图层 (有 canvas) 且没有被标记为特殊组件容器
      // 注意：如果是 Com$xxx，它本身是个组，但也可能包含背景图？通常 Com$ 是 Group
      // 我们只处理叶子节点的图片，或者被标记为 @img 的图层
      
      // 只有 Image 类型才导出资源
      if (info.type === 'Image' && layer.canvas) {
        await this.exportImage(layer, info);
      }
    }
  }

  /**
   * 处理多颜色文本 (FGUI UBB 格式)
   * 自动识别占比最高的颜色为主色，其余使用 [color] 标签
   */
  private processMultiColorText(textInfo: any): { mainColor: string, text: string, isRich: boolean } {
    const { text, color: defaultColor, styleRuns } = textInfo;
    
    // 如果没有 styleRuns 或只有一个片段，直接返回
    if (!styleRuns || styleRuns.length <= 1) {
      return { mainColor: defaultColor || '#000000', text: text || '', isRich: false };
    }
    
    // 1. 统计各颜色的字符数
    const colorCount: Map<string, number> = new Map();
    for (const run of styleRuns) {
      const runColor = run.color || defaultColor || '#000000';
      const count = colorCount.get(runColor) || 0;
      colorCount.set(runColor, count + run.text.length);
    }
    
    // 2. 找出占比最高的颜色作为主色
    let mainColor = defaultColor || '#000000';
    let maxCount = 0;
    for (const [runColor, count] of colorCount.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mainColor = runColor;
      }
    }
    
    // 3. 生成带 UBB 标签的文本
    let richText = '';
    let hasDifferentColor = false;
    
    for (const run of styleRuns) {
      const runColor = run.color || defaultColor || '#000000';
      // 颜色不同于主色时，添加 UBB 标签
      if (runColor.toLowerCase() !== mainColor.toLowerCase()) {
        richText += `[color=${runColor}]${run.text}[/color]`;
        hasDifferentColor = true;
      } else {
        richText += run.text;
      }
    }
    
    // 如果没有任何不同颜色的片段，说明全是主色，不需要 UBB
    if (!hasDifferentColor) {
      return { mainColor, text: text || '', isRich: false };
    }
    
    return { mainColor, text: richText, isRich: true };
  }

  // 还原九宫格图片 (从拉伸后的大图还原回小图)
  private reduceScale9Image(canvas: HTMLCanvasElement, targetW: number, targetH: number, grid: number[]): HTMLCanvasElement {
    // grid: [top, right, bottom, left]
    const [top, right, bottom, left] = grid;
    
    // 原图尺寸 (拉伸后的)
    const srcW = canvas.width;
    const srcH = canvas.height;
    
    const result = document.createElement('canvas');
    result.width = targetW;
    result.height = targetH;
    const ctx = result.getContext('2d');
    if (!ctx) return canvas;
    
    // 1. 左上角 (Top-Left)
    if (top > 0 && left > 0)
      ctx.drawImage(canvas, 0, 0, left, top, 0, 0, left, top);
      
    // 2. 右上角 (Top-Right)
    if (top > 0 && right > 0)
      ctx.drawImage(canvas, srcW - right, 0, right, top, targetW - right, 0, right, top);
      
    // 3. 左下角 (Bottom-Left)
    if (bottom > 0 && left > 0)
      ctx.drawImage(canvas, 0, srcH - bottom, left, bottom, 0, targetH - bottom, left, bottom);
      
    // 4. 右下角 (Bottom-Right)
    if (bottom > 0 && right > 0)
      ctx.drawImage(canvas, srcW - right, srcH - bottom, right, bottom, targetW - right, targetH - bottom, right, bottom);
      
    // 5. 上边 (Top Edge) - 拉伸/缩放
    if (top > 0 && (targetW - left - right) > 0) {
       ctx.drawImage(canvas, 
          left, 0, srcW - left - right, top, 
          left, 0, targetW - left - right, top
       );
    }
    
    // 6. 下边 (Bottom Edge)
    if (bottom > 0 && (targetW - left - right) > 0) {
       ctx.drawImage(canvas, 
          left, srcH - bottom, srcW - left - right, bottom, 
          left, targetH - bottom, targetW - left - right, bottom
       );
    }
    
    // 7. 左边 (Left Edge)
    if (left > 0 && (targetH - top - bottom) > 0) {
       ctx.drawImage(canvas, 
          0, top, left, srcH - top - bottom, 
          0, top, left, targetH - top - bottom
       );
    }
    
    // 8. 右边 (Right Edge)
    if (right > 0 && (targetH - top - bottom) > 0) {
       ctx.drawImage(canvas, 
          srcW - right, top, right, srcH - top - bottom, 
          targetW - right, top, right, targetH - top - bottom
       );
    }
    
    // 9. 中间 (Center)
    if ((targetW - left - right) > 0 && (targetH - top - bottom) > 0) {
       ctx.drawImage(canvas, 
          left, top, srcW - left - right, srcH - top - bottom, 
          left, top, targetW - left - right, targetH - top - bottom
       );
    }
    
    return result;
  }

  // 导出单张图片
  private async exportImage(layer: PsdLayer, info: FguiNodeInfo) {
    if (!layer.canvas) return;

    // 转换 Blob
    // 使用 LayerRenderer 烘焙图层效果 (渐变叠加、描边、投影等)
    const bakedCanvas = await this.renderer.bakeLayer(layer);
    const targetCanvas = bakedCanvas || layer.canvas!;
    
    // 更新宽度高度以匹配烘焙后的尺寸 (可能因为描边变大)
    const exportWidth = targetCanvas.width;
    const exportHeight = targetCanvas.height;

    // 0. 检查是否在公共包中已存在 (仅通过文件名匹配)
    if (this.commonResources.has(info.exportName)) {
      const res = this.commonResources.get(info.exportName)!;
      // 记录引用，不导出文件
      this.resourceMap[layer.id] = {
        id: res.id,
        fileName: info.exportName + '.png',
        packageId: res.packageId,
        width: res.width > 0 ? res.width : exportWidth, 
        height: res.height > 0 ? res.height : exportHeight,
        path: '/' 
      };
      console.log(`[FGUI] Reuse common resource: ${info.exportName} (pkg=${res.packageId})`);
      return;
    }

    // 如果有 targetSize (九宫格还原)，使用该尺寸作为导出尺寸
    let finalExportWidth = exportWidth;
    let finalExportHeight = exportHeight;
    
    if (info.targetSize && info.scale9Grid) {
       finalExportWidth = info.targetSize.width;
       finalExportHeight = info.targetSize.height;
    }

    // 判断目标包
    let targetPkg = this.currentPackage!;
    let subDir = 'Assets';
    let fileName = info.exportName + '.png';

    // 1. 大图检查 -> BigFile 包
    // 使用 finalExportWidth/Height 判断 (还原后的小图通常不会是大图)
    if (finalExportWidth > this.largeImageThreshold || finalExportHeight > this.largeImageThreshold) {
      if (this.bigFilePackage) {
        targetPkg = this.bigFilePackage;
        subDir = ''; // BigFile 包通常放根目录
        console.log(`[FGUI] Exporting big file to ${targetPkg.name}: ${fileName}`);
      }
    } 
    // 2. Common 检查
    else if (info.isCommon) {
      targetPkg = this.commonPackage!;
    }

    const filePath = subDir ? `/${subDir}/` : '/';

    // 检查目标包中是否已存在同名资源 (去重)
    const existingRes = targetPkg.resources.find(r => r.name === fileName && r.path === filePath);
    
    if (existingRes) {
        // 复用
        const isCrossPackage = targetPkg !== this.currentPackage;
        this.resourceMap[layer.id] = {
            id: existingRes.id,
            fileName,
            packageId: isCrossPackage ? targetPkg.id : '',
            width: exportWidth,
            height: exportHeight,
            path: filePath
        };
        console.log(`[FGUI] Reuse existing resource in package: ${fileName}`);
        return;
    }

    const fileId = generateId();

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = finalExportWidth;
    exportCanvas.height = finalExportHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;
    
    // 确保透明背景
    ctx.clearRect(0, 0, finalExportWidth, finalExportHeight);
    
    if (info.targetSize && info.scale9Grid) {
       // 九宫格还原绘制
       const reduced = this.reduceScale9Image(targetCanvas, finalExportWidth, finalExportHeight, info.scale9Grid);
       ctx.drawImage(reduced, 0, 0);
    } else {
       // 普通绘制
       ctx.drawImage(targetCanvas, 0, 0);
    }

    const blob = await new Promise<Blob | null>(resolve => exportCanvas.toBlob(resolve, 'image/png'));
    if (!blob) return;

    // 写入文件
    let targetDir = targetPkg.handle;
    if (subDir) targetDir = await this.getDirectory(targetDir, subDir);
    
    await this.writeFile(targetDir, fileName, blob);
    
    // 记录资源 (添加 packageId，如果是跨包引用)
    // 如果目标是当前包，packageId 为空；如果是其他包（Common/BigFile），需要 packageId
    const isCrossPackage = targetPkg !== this.currentPackage;
    
    this.resourceMap[layer.id] = {
      id: fileId,
      fileName,
      packageId: isCrossPackage ? targetPkg.id : '',
      width: exportWidth,
      height: exportHeight,
      path: filePath
    };
    
    // 添加到目标包的资源列表
    targetPkg.resources.push({
      id: fileId,
      name: fileName,
      type: 'image',
      path: filePath,
      exported: true,
      scale9grid: info.scale9Grid, // 传递九宫格数据 [T, R, B, L]
      width: finalExportWidth,     // 传递实际图片尺寸，用于计算九宫格 rect
      height: finalExportHeight
    });
  }

  // 处理组件生成
  private async processComponents(layers: PsdLayer[]) {
    // 寻找所有 Com$ 开头的组
    for (const layer of layers) {
      const info = parseLayerName(layer.name, this.namingRules);
      
      if (info.noExport) continue;

      // 0. 检查是否是公共组件 (复用)
      if (info.isExported) {
         if (this.commonResources.has(info.exportName)) {
             const res = this.commonResources.get(info.exportName)!;
             if (res.type === 'component') {
                 // 记录引用，跳过生成
                 this.resourceMap[layer.id] = {
                     id: res.id,
                     fileName: info.exportName + '.xml',
                     packageId: res.packageId,
                     width: 0, 
                     height: 0,
                     path: '/' 
                 };
                 console.log(`[FGUI] Reuse common component: ${info.exportName} (pkg=${res.packageId})`);
                 continue; // 跳过子节点处理和组件生成
             }
         }
      }

      // 1. 优先递归处理子图层中的组件 (Bottom-Up)
      // 这样子组件会先被生成并注册到 resourceMap 中
      // 当父组件生成时，就能通过 resourceMap 找到子组件并建立引用关系
      if (layer.children) {
        await this.processComponents(layer.children);
      }

      // 2. 处理当前组件
      if (info.isExported && layer.children) {
        await this.generateComponentFile(layer, info);
      }
    }
  }

  // 计算图层的可视边界（排除不可见或不导出的子元素）
  private getVisualBounds(layer: PsdLayer): LayerBounds {
    // 非组图层或无子元素，直接返回原始 bounds
    if (layer.type !== 'group' || !layer.children) {
      return layer.bounds;
    }
    
    // 组图层：计算可见且导出的子元素的并集
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    let hasContent = false;
    
    for (const child of layer.children) {
      if (!child.visible) continue;
      const info = parseLayerName(child.name, this.namingRules);
      if (info.noExport) continue;
      
      const b = this.getVisualBounds(child); // 递归计算
      if (b.right <= b.left || b.bottom <= b.top) continue; // 空区域
      
      hasContent = true;
      left = Math.min(left, b.left);
      top = Math.min(top, b.top);
      right = Math.max(right, b.right);
      bottom = Math.max(bottom, b.bottom);
    }
    
    // 如果没有有效内容，返回 0 (或原始 bounds?)
    // 如果是空组，最好保持原始 bounds 避免错误，或者设为 0
    if (!hasContent) return { left: 0, top: 0, right: 0, bottom: 0 };
    
    return { left, top, right, bottom };
  }

  // 生成主界面组件
  private async generateMainComponent(psd: PsdDocument, componentName: string) {
    const fileName = componentName + '.xml';
    const componentId = generateId();
    
    // 生成显示列表 (offset 0,0)
    const displayList = await this.buildDisplayList(psd.layers, 0, 0);
    
    const xmlContent = generateComponentXml(psd.width, psd.height, displayList);
    
    // 写入当前包的 View 目录
    const targetPkg = this.currentPackage!;
    const viewDir = await this.getDirectory(targetPkg.handle, 'View');
    await this.writeFile(viewDir, fileName, xmlContent);
    
    // 添加到资源列表
    const existing = targetPkg.resources.find(r => r.name === fileName);
    if (!existing) {
      targetPkg.resources.push({
        id: componentId,
        name: fileName,
        type: 'component',
        path: '/View/',
        exported: true
      });
    }
  }

  // 生成组件文件 (.xml)
  private async generateComponentFile(layer: PsdLayer, info: FguiNodeInfo) {
    if (!layer.children) return;

    // 确定目标包
    let targetPkg = this.currentPackage!;
    if (info.isCommon) {
      targetPkg = this.commonPackage!;
    }

    const componentId = generateId();
    
    // 检查命名冲突 (与 Image 冲突)
    let finalExportName = info.exportName;
    // 检查是否存在同名但非 component 类型的资源
    const hasConflict = targetPkg.resources.some(r => {
        const rName = r.name.replace(/\.[^/.]+$/, "");
        return rName === finalExportName && r.type !== 'component';
    });
    
    if (hasConflict) {
        finalExportName += '_Comp';
        console.warn(`[FGUI] Name conflict detected: ${info.exportName} -> ${finalExportName}`);
    }

    const fileName = finalExportName + '.xml';
    
    // 生成 DisplayList
    // 使用可视边界（紧包围内容）
    const bounds = this.getVisualBounds(layer);
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;

    const displayList = await this.buildDisplayList(layer.children, bounds.left, bounds.top);

    // 生成 XML
    let extention;
    if (info.type === 'Button') extention = 'Button';
    if (info.type === 'ProgressBar') extention = 'ProgressBar';
    // ... 其他扩展类型

    const xmlContent = generateComponentXml(width, height, displayList, extention);

    // 写入文件
    const componentDir = await this.getDirectory(targetPkg.handle, 'Component');
    await this.writeFile(componentDir, fileName, xmlContent);

    // 添加到 package.xml
    const existing = targetPkg.resources.find(r => r.name === fileName);
    if (!existing) {
      targetPkg.resources.push({
        id: componentId,
        name: fileName,
        type: 'component',
        path: '/Component/',
        exported: true // 组件默认导出
      });
    }
    
    // 记录组件映射 (供其他组件引用)
    this.resourceMap[layer.id] = {
      id: existing ? existing.id : componentId,
      fileName,
      packageId: targetPkg.id,
      width,
      height,
      path: '/Component/'
    };
  }

  // 构建 DisplayList XML 节点
  private async buildDisplayList(
    layers: PsdLayer[], 
    offsetX: number, 
    offsetY: number, 
    indexCounter?: { value: number }
  ): Promise<any[]> {
    const counter = indexCounter || { value: 0 };
    const nodes: any[] = [];

    for (const child of layers) {
      if (!child.visible) continue;

      const childInfo = parseLayerName(child.name, this.namingRules);
      if (childInfo.noExport) continue;
      
      // 使用可视边界计算位置和尺寸
      const bounds = this.getVisualBounds(child);
      const x = bounds.left - offsetX;
      const y = bounds.top - offsetY;
      const w = bounds.right - bounds.left;
      const h = bounds.bottom - bounds.top;

      const commonAttrs: any = {
        id: generateId(),
        name: `n${counter.value++}`, // 使用共享计数器
        xy: `${Math.round(x)},${Math.round(y)}`,
        size: `${Math.round(w)},${Math.round(h)}`
      };

      // 添加透明度
      if (child.opacity !== undefined && child.opacity < 1) {
        commonAttrs.alpha = child.opacity.toFixed(2);
      }

      // 1. 如果是引用的嵌套组件
      if (childInfo.isExported && this.resourceMap[child.id]) {
        const res = this.resourceMap[child.id];
        nodes.push({
          tag: 'component',
          attrs: {
            ...commonAttrs,
            src: res.id,
            pkg: res.packageId && res.packageId !== this.currentPackage?.id ? res.packageId : undefined
          }
        });
        continue;
      }

        // 2. 文本 (自动识别 PSD 文本图层 或 InputText/RichText)
      if (child.textInfo || childInfo.type === 'Text' || childInfo.type === 'InputText' || childInfo.type === 'RichText') {
        const textInfo = child.textInfo;
        
        // 计算最终字号 (应用 DPI 修正)
        // psdParser 已经应用了 transform 缩放，所以这里只需要处理 DPI
        let fontSize = textInfo?.fontSize || 12;
        fontSize = fontSize * (this.resolution / 72);
        
        let scaleX = 1;
        let scaleY = 1;

        if (textInfo?.transform && textInfo.transform.length >= 4) {
          scaleX = Math.abs(textInfo.transform[0]);
          scaleY = Math.abs(textInfo.transform[3]);
          // 注意：fontSize 已经在 parser 中处理过缩放，这里不需要再乘 scaleY
        }

        let overrideX: number | undefined;
        let overrideY: number | undefined;

        // 对于区域文本，使用 boxBounds 计算准确的宽高和位置
        if (textInfo?.textShape === 'box' && textInfo.boxBounds) {
          // boxBounds: [top, left, bottom, right]
          const bTop = textInfo.boxBounds[0];
          const bLeft = textInfo.boxBounds[1];
          let boxW = textInfo.boxBounds[3] - bLeft;
          let boxH = textInfo.boxBounds[2] - bTop;
          
          // Apply Transform Scale
          boxW *= scaleX;
          boxH *= scaleY;
          
          // Apply Transform Position
          if (textInfo.transform && textInfo.transform.length >= 6) {
             const t = textInfo.transform;
             // Calculate top-left corner in document space
             const tx = t[0] * bLeft + t[2] * bTop + t[4];
             const ty = t[1] * bLeft + t[3] * bTop + t[5];
             overrideX = tx;
             overrideY = ty;
          }
          
          // 如果 transform 计算不可靠（或者没有），使用内容对齐反推位置
          // 确保文字内容在视觉上不偏移
          // boxX = contentX + alignOffset
          if (overrideX === undefined || overrideY === undefined) {
             const contentLeft = bounds.left;
             const contentWidth = bounds.right - bounds.left;
             const align = textInfo.textAlign || 'left';
             
             let finalBoxX = contentLeft;
             if (align === 'center') {
                finalBoxX = contentLeft + contentWidth / 2 - boxW / 2;
             } else if (align === 'right') {
                finalBoxX = contentLeft + contentWidth - boxW;
             }
             
             overrideX = finalBoxX;
             overrideY = bounds.top; // Y 通常对齐 Top
          }
          
          commonAttrs.size = `${Math.round(boxW)},${Math.round(boxH)}`;
        } else {
          // 对于点文本 (Point Text)
          // 修正垂直偏移：FGUI 文本框顶部包含 Ascent，导致文字视觉偏下
          // 向上偏移约 10-15% 字号以对齐基线/视觉顶部
          const yOffset = Math.round(fontSize * 0.15);
          overrideY = bounds.top - yOffset;
          overrideX = bounds.left;
        }

        // Update position if overridden
        if (overrideX !== undefined && overrideY !== undefined) {
           const finalX = overrideX - offsetX;
           const finalY = overrideY - offsetY;
           commonAttrs.xy = `${finalX},${finalY}`;
        }

        // 处理多色文本 (UBB)
        const { mainColor, text: textContent, isRich } = this.processMultiColorText(textInfo);
        const ubb = isRich ? 'true' : undefined;

        const textAttrs: any = {
          ...commonAttrs,
          text: textContent,
          color: mainColor, // 使用计算出的主色
          fontSize: Math.round(fontSize),
          font: textInfo?.fontFamily || 'Arial',
          align: textInfo?.textAlign || 'left',
          leading: textInfo?.lineHeight ? Math.round(textInfo.lineHeight - (textInfo?.fontSize || 12)) : undefined,
          letterSpacing: textInfo?.letterSpacing,
          bold: textInfo?.bold ? 'true' : undefined,
          italic: textInfo?.italic ? 'true' : undefined,
          underline: textInfo?.underline ? 'true' : undefined,
          autoSize: textInfo?.textShape === 'point' ? 'both' : 'none', // 点文本自动大小，区域文本固定大小
          ubb
        };

        // 处理 InputText (@txt)
        if (childInfo.type === 'InputText') {
          textAttrs.input = 'true';
          // 输入框必须固定大小，不能是 autoSize='both'
          textAttrs.autoSize = 'none';
          
          // 输入框高度应该基于图层实际高度，并确保不小于字号或行高
          const fontSize = Number(textAttrs.fontSize) || 12;
          const preferredH = (child.textInfo?.lineHeight && child.textInfo.lineHeight > fontSize) 
            ? Math.round(child.textInfo.lineHeight) 
            : Math.round(fontSize * 1.25);
            
          const boundsH = bounds.bottom - bounds.top;
          const h = Math.max(boundsH, preferredH);
          
          const w = bounds.right - bounds.left;
          textAttrs.size = `${Math.round(w)},${Math.round(h)}`;
        }
        
        // 处理 RichText (@rich)
        if (childInfo.type === 'RichText') {
           nodes.push({
             tag: 'richtext', // FGUI RichTextField 对应 XML 标签是 richtext
             attrs: {
               ...textAttrs,
             }
           });
           continue; // Skip the default 'text' push
        }

        // 处理描边效果 (优先使用图层效果，其次使用字符属性)
        if (child.effects?.stroke && child.effects.stroke.length > 0) {
          const stroke = child.effects.stroke[0];
          textAttrs.strokeColor = stroke.color;
          textAttrs.strokeSize = Math.round(stroke.width);
        } else if (textInfo?.strokeColor && textInfo.strokeWidth) {
          textAttrs.strokeColor = textInfo.strokeColor;
          textAttrs.strokeSize = Math.round(textInfo.strokeWidth);
        }

        nodes.push({
          tag: 'text',
          attrs: textAttrs
        });
        continue;
      }

      // 3. 如果是图片 (有资源)
      if (this.resourceMap[child.id]) {
        const res = this.resourceMap[child.id];
        
        // 检查是否是 loader (@img)
        if (childInfo.isImg) {
           nodes.push({
            tag: 'loader',
            attrs: {
              ...commonAttrs,
              url: `ui://${res.packageId}${res.path}${res.fileName}`, // Loader 使用 URL
              align: 'center',
              vAlign: 'middle'
            }
          });
        } else {
          // 普通 Image
          const attrs: any = {
            ...commonAttrs,
            src: res.id,
            pkg: res.packageId && res.packageId !== this.currentPackage?.id ? res.packageId : undefined
          };
          
          // 九宫格
          // 移除：scale9grid 属性应该在 package.xml 中设置，组件中引用时不需要重复设置
          // 除非需要覆盖资源属性，但通常我们希望保持一致
          // if (childInfo.scale9Grid) {
          //   attrs.scale9grid = childInfo.scale9Grid.join(',');
          // }

          nodes.push({
            tag: 'image',
            attrs
          });
        }
        continue;
      }

      // 4. 普通组 (未标记 Com$) -> FGUI Group?
      // FGUI 的 Group 是虚的，通常用 Component 替代或者只是逻辑分组
      // 简单处理：如果 PSD 里有个组但没标记为 Component，我们通常应该递归展开它的子节点，
      // 并在坐标上加上组的偏移？
      // 或者将其视为一个普通的 container (graph)? FGUI 只有 Component 是容器。
      // **策略**：展开未标记的 Group。
      if (child.type === 'group' && child.children) {
        // 递归展平
        // 注意坐标系：子节点的 bounds 已经是绝对坐标了，所以 offsetX/Y 依然是父组件的。
        // 传递共享的 indexCounter
        const groupNodes = await this.buildDisplayList(child.children, offsetX, offsetY, counter);
        nodes.push(...groupNodes);
      }
    }

    return nodes;
  }

  // 保存 package.xml
  private async savePackageXml(pkg: PackageContext | null) {
    if (!pkg) return;
    const xml = generatePackageXml(pkg.id, pkg.resources);
    await this.writeFile(pkg.handle, 'package.xml', xml);
  }
}
