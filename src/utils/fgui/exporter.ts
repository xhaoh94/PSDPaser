import type { PsdDocument, PsdLayer, LayerBounds } from '../../types/psd';
import { parsePsdFileName, parseLayerName } from './nameParser';
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
  
  // 上下文
  private currentPackage: PackageContext | null = null;
  private commonPackage: PackageContext | null = null;
  private singlePackage: PackageContext | null = null;
  
  // 资源缓存
  private resourceMap: ResourceMap = {};

  constructor(rootHandle: FileSystemDirectoryHandle, largeImageThreshold = 512, namingRules?: NamingRules) {
    this.rootHandle = rootHandle;
    this.largeImageThreshold = largeImageThreshold;
    this.namingRules = namingRules;
    this.renderer = new LayerRenderer();
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
    if (name !== 'Single') {
      await this.getDirectory(packageDir, 'Component');
      await this.getDirectory(packageDir, 'Assets');
      await this.getDirectory(packageDir, 'View');
    }

    return {
      id,
      name,
      resources: existingResources,
      handle: packageDir
    };
  }

  // 主导出方法
  public async export(psd: PsdDocument, packageName: string, viewName: string): Promise<void> {
    this.resolution = psd.resolution || 72;

    // 2. 初始化包环境
    this.currentPackage = await this.initPackage(packageName);
    this.commonPackage = await this.initPackage('Common');
    this.singlePackage = await this.initPackage('Single');
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
    await this.savePackageXml(this.singlePackage);
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

  // 导出单张图片
  private async exportImage(layer: PsdLayer, info: FguiNodeInfo) {
    if (!layer.canvas) return;

    const width = layer.canvas.width;
    const height = layer.canvas.height;
    
    // 判断目标包
    let targetPkg = this.currentPackage!;
    let subDir = 'Assets';
    let fileName = info.exportName + '.png';

    // 1. 大图检查 -> Single 包
    if (width > this.largeImageThreshold || height > this.largeImageThreshold) {
      targetPkg = this.singlePackage!;
      subDir = ''; // Single 包直接放根目录
    } 
    // 2. Common 检查
    else if (info.isCommon) {
      targetPkg = this.commonPackage!;
    }

    const fileId = generateId();
    const filePath = subDir ? `/${subDir}/` : '/';
    
    // 转换 Blob
    // 使用 LayerRenderer 烘焙图层效果 (渐变叠加、描边、投影等)
    const bakedCanvas = await this.renderer.bakeLayer(layer);
    const targetCanvas = bakedCanvas || layer.canvas!;
    
    // 更新宽度高度以匹配烘焙后的尺寸 (可能因为描边变大)
    const exportWidth = targetCanvas.width;
    const exportHeight = targetCanvas.height;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;
    
    // 确保透明背景
    ctx.clearRect(0, 0, exportWidth, exportHeight);
    ctx.drawImage(targetCanvas, 0, 0);

    const blob = await new Promise<Blob | null>(resolve => exportCanvas.toBlob(resolve, 'image/png'));
    if (!blob) return;

    // 写入文件
    let targetDir = targetPkg.handle;
    if (subDir) targetDir = await this.getDirectory(targetDir, subDir);
    
    await this.writeFile(targetDir, fileName, blob);

    // 记录资源
    this.resourceMap[layer.id] = {
      id: fileId,
      fileName,
      packageId: targetPkg.id,
      width: exportWidth,
      height: exportHeight,
      path: filePath + fileName
    };

    // 添加到 package.xml 资源列表
    // 查重：同名资源是否已存在
    const existing = targetPkg.resources.find(r => r.name === fileName && r.path === filePath);
    if (!existing) {
      targetPkg.resources.push({
        id: fileId,
        name: fileName,
        type: 'image',
        path: filePath
      });
    } else {
      // 更新 ID 映射，使用已存在的 ID
      this.resourceMap[layer.id].id = existing.id;
    }
  }

  // 处理组件生成
  private async processComponents(layers: PsdLayer[]) {
    // 寻找所有 Com$ 开头的组
    for (const layer of layers) {
      const info = parseLayerName(layer.name, this.namingRules);
      
      if (info.noExport) continue;

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
    const fileName = info.exportName + '.xml';
    
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
  private async buildDisplayList(layers: PsdLayer[], offsetX: number, offsetY: number): Promise<any[]> {
    const nodes: any[] = [];
    let elementIndex = 0; // 用于生成 n0, n1...

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
        name: `n${elementIndex++}`, // 使用 fgui 默认的 n0, n1... 命名
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
            pkg: res.packageId !== this.currentPackage?.id ? res.packageId : undefined
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
        // 只要有 styleRuns，就假设可能有样式变化，使用 UBB
        let textContent = textInfo?.text || '';
        let ubb: string | undefined = undefined;

        if (textInfo?.styleRuns && textInfo.styleRuns.length > 1) {
          // 合并相邻且样式相同的片段
          const mergedRuns: any[] = [];
          let lastRun: any = null;
          for (const run of textInfo.styleRuns) {
             if (lastRun && lastRun.color === run.color) {
                lastRun.text += run.text;
             } else {
                lastRun = { ...run };
                mergedRuns.push(lastRun);
             }
          }
          
          // 检查是否有多种颜色
          const distinctColors = new Set(mergedRuns.map(r => r.color));
          const hasDifferentColor = distinctColors.size > 1 || (distinctColors.size === 1 && mergedRuns[0].color !== textInfo.color);
          
          if (hasDifferentColor) {
            ubb = 'true';
            textContent = mergedRuns.map(run => {
              let content = run.text;
              // 只有颜色不同于主颜色时才加标签
              if (run.color && run.color !== textInfo.color) {
                content = `[color=${run.color}]${content}[/color]`;
              }
              return content;
            }).join('');
          }
        }

        const textAttrs: any = {
          ...commonAttrs,
          text: textContent,
          color: textInfo?.color || '#000000',
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
            pkg: res.packageId !== this.currentPackage?.id ? res.packageId : undefined
          };
          
          // 九宫格
          if (childInfo.scale9Grid) {
            attrs.scale9grid = childInfo.scale9Grid.join(',');
          }

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
        const groupNodes = await this.buildDisplayList(child.children, offsetX, offsetY);
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
