import { YamlBuilder } from './yamlBuilder';
import type { PsdLayer } from '../../types/psd';
import type { UGUINodeInfo } from './types';
import { parseLayerName } from './nameParser';
import type { SpriteInfo } from './types';
import type { NamingRules } from '../../stores/configStore';

interface PrefabNode {
  layer: PsdLayer;
  info: UGUINodeInfo;
  gameObjectId: string;
  rectId: string;
  componentId?: string;
  canvasRendererId?: string;
  outlineId?: string; // 用于文本描边 (Outline组件)
  children: PrefabNode[];
  sprite?: SpriteInfo;
}

export class PrefabGenerator {
  private builder: YamlBuilder;
  private width: number;
  private height: number;
  private spriteMap: Map<string, SpriteInfo>;
  private namingRules?: NamingRules;
  private fontMap?: Map<string, string>;

  constructor(
    width: number, 
    height: number, 
    spriteMap: Map<string, SpriteInfo>, 
    namingRules?: NamingRules,
    fontMap?: Map<string, string>
  ) {
    this.builder = new YamlBuilder();
    this.width = width;
    this.height = height;
    this.spriteMap = spriteMap;
    this.namingRules = namingRules;
    this.fontMap = fontMap;
  }

  private generateId(): string {
    return Math.floor(Math.random() * 2000000000 + 100000000).toString();
  }

  private buildNodeTree(layers: PsdLayer[]): PrefabNode[] {
    const nodes: PrefabNode[] = [];
    // PSD图层顺序：数组前面的在底层，后面的在顶层
    // Unity渲染顺序：Hierarchy中后面的渲染在上方（后渲染在上）
    // 所以保持原顺序即可，不要反转
    
    for (const layer of layers) {
      if (!layer.visible) continue;
      
      const info = parseLayerName(layer.name, layer.type, this.namingRules);
      if (info.noExport) continue;
      
      // Group 类型的图层，如果没有 canvas，则视为纯容器，不生成 componentId
      const isContainerGroup = layer.type === 'group' && !layer.canvas;
      const isText = info.type === 'Text';
      
      // 检查文本描边：可能作为图层效果(effects.stroke)或文本样式(textInfo.strokeColor)存储
      const hasTextStyleStroke = isText && layer.textInfo?.strokeColor && layer.textInfo?.strokeWidth;
      const hasEffectStroke = isText && layer.effects?.stroke && layer.effects.stroke.length > 0;
      const hasStroke = hasTextStyleStroke || hasEffectStroke;
      
      if (isText) {
        console.log(`[PrefabGenerator] Text "${layer.name}" stroke check:`, {
          hasTextStyleStroke,
          hasEffectStroke,
          textInfo_strokeColor: layer.textInfo?.strokeColor,
          textInfo_strokeWidth: layer.textInfo?.strokeWidth,
          effects_stroke: layer.effects?.stroke?.length
        });
      }
      
      const node: PrefabNode = {
        layer,
        info,
        gameObjectId: this.generateId(),
        rectId: this.generateId(),
        children: layer.children ? this.buildNodeTree(layer.children) : [],
        // 如果不是纯容器Group，且被标记为Image或Text，则生成 componentId
        componentId: (!isContainerGroup && (info.type === 'Image' || info.type === 'Text')) ? this.generateId() : undefined
      };
      
      // 如果文本有描边，需要额外的 Outline 组件
      if (hasStroke) {
        node.outlineId = this.generateId();
        console.log(`[PrefabGenerator] Text "${layer.name}" has stroke, created outlineId: ${node.outlineId}, strokeColor: ${layer.textInfo?.strokeColor}, strokeWidth: ${layer.textInfo?.strokeWidth}`);
      } else if (isText) {
        console.log(`[PrefabGenerator] Text "${layer.name}" no stroke - strokeColor: ${layer.textInfo?.strokeColor}, strokeWidth: ${layer.textInfo?.strokeWidth}`);
      }
      
      if (info.type === 'Image') {
        const sprite = this.spriteMap.get(info.exportName);
        if (sprite) node.sprite = sprite;
      }
      
      nodes.push(node);
    }
    return nodes;
  }

  // 阶段1：生成所有 GameObject
  private generateGameObjects(nodes: PrefabNode[]) {
    for (const node of nodes) {
      const components = [node.rectId];
      
      if (node.componentId) {
        node.canvasRendererId = this.generateId();
        components.push(node.canvasRendererId, node.componentId);
      }
      
      // 如果有描边，添加 Outline 组件
      if (node.outlineId) {
        components.push(node.outlineId);
        console.log(`[PrefabGenerator] Added outlineId ${node.outlineId} to GameObject "${node.info.exportName}"`);
      }
      
      console.log(`[PrefabGenerator] GameObject "${node.info.exportName}" components:`, components);
      this.builder.buildGameObject(node.gameObjectId, node.info.exportName, components, node.layer.visible);
      if (node.children.length > 0) this.generateGameObjects(node.children);
    }
  }

  // 计算 Group 的边界（基于子元素）
  private calculateGroupBounds(node: PrefabNode): { left: number, right: number, top: number, bottom: number } {
    if (node.children.length === 0) {
      return node.layer.bounds;
    }
    
    let minLeft = Infinity, maxRight = -Infinity, minTop = Infinity, maxBottom = -Infinity;
    
    for (const child of node.children) {
      const b = child.layer.bounds;
      minLeft = Math.min(minLeft, b.left);
      maxRight = Math.max(maxRight, b.right);
      minTop = Math.min(minTop, b.top);
      maxBottom = Math.max(maxBottom, b.bottom);
    }
    
    return { left: minLeft, right: maxRight, top: minTop, bottom: maxBottom };
  }

  // 阶段2：生成所有 RectTransform
  private generateTransforms(nodes: PrefabNode[], parentRectId: string, parentBounds?: { cx: number, cy: number }) {
    for (const node of nodes) {
      const isGroup = node.layer.type === 'group';
      const isText = node.info.type === 'Text';
      let bounds = node.layer.bounds;
      
      // 如果是 Group 且没有有效尺寸，则计算子元素的边界
      if (isGroup) {
        const w = bounds.right - bounds.left;
        const h = bounds.bottom - bounds.top;
        if (w <= 0 || h <= 0) {
          bounds = this.calculateGroupBounds(node);
        }
      }
      
      let w = bounds.right - bounds.left;
      let h = bounds.bottom - bounds.top;
      
      // 文本尺寸和位置修正
      let yOffset = 0;
      let originalW = w; // 保存原始宽度
      let originalH = h; // 保存原始高度
      
      if (isText && node.layer.textInfo) {
        const fontSize = node.layer.textInfo.fontSize || 20;
        
        // 1. 宽度修复：增加 padding 防止换行
        w += 8; 
        
        // 2. 高度修复
        const minHeight = Math.ceil(fontSize * 1.25);
        if (h < minHeight) {
          h = minHeight;
        }
        
        // 3. Y轴微调：由于字体差异（PSD vs Unity默认字体），垂直对齐很难完美。
        // 用户反馈之前上移会导致偏高，现在改为不做额外偏移，保持几何中心对齐。
        // Unity Text 默认 Alignment 是 Middle Center，理论上应该居中。
        yOffset = 0;
        
        // 确保宽度也满足最小估算
        const textLength = node.layer.textInfo.text.length;
        const minWidth = Math.min(textLength * fontSize * 0.8, 200);
        if (w < minWidth) {
          w = minWidth;
        }
      }
      
      // 计算当前节点的中心点（在画布坐标系中）
      // 根据文本对齐方式调整中心点，以保持视觉位置不变
      // 默认（居中对齐或其他）：保持几何中心不变
      let nodeCenterX = bounds.left + originalW / 2;
      
      if (isText && node.layer.textInfo) {
        const align = node.layer.textInfo.textAlign || 'left';
        
        // 根据对齐方式调整中心点
        // 这样即使宽度增加了，或者字体有差异，也能保持对齐边的位置不变
        if (align === 'left') {
          // 左对齐：保持左边界不变，向右扩展宽度
          // 新中心 = 左边界 + 新宽度/2
          nodeCenterX = bounds.left + w / 2;
        } else if (align === 'right') {
          // 右对齐：保持右边界不变，向左扩展宽度
          // 新中心 = 右边界 - 新宽度/2
          nodeCenterX = bounds.right - w / 2;
        }
        // center/justify: 保持中心不变 (已默认处理)
      } else {
        // 非文本节点
        if (!isText) {
           nodeCenterX = bounds.left + w / 2;
        }
      }

      const nodeCenterY = bounds.top + originalH / 2 + yOffset;
      
      // Unity坐标系：Y轴向上为正，PSD坐标系：Y轴向下为正（top=0）
      // 统一转换：相对于父节点中心的偏移，Y轴需要翻转
      let anchoredPosX: number;
      let anchoredPosY: number;
      
      if (parentBounds) {
        // 子节点：相对于父节点的偏移
        anchoredPosX = nodeCenterX - parentBounds.cx;
        anchoredPosY = -(nodeCenterY - parentBounds.cy); // Y轴翻转
      } else {
        // 根节点：相对于画布中心
        anchoredPosX = nodeCenterX - this.width / 2;
        anchoredPosY = -(nodeCenterY - this.height / 2); // Y轴翻转：PSD的上方(Unity的下方)变为负值
      }
      
      const rectProps = {
        anchorMin: { x: 0.5, y: 0.5 },
        anchorMax: { x: 0.5, y: 0.5 },
        anchoredPosition: { x: anchoredPosX, y: anchoredPosY },
        sizeDelta: { x: w, y: h },
        pivot: { x: 0.5, y: 0.5 }
      };
      
      this.builder.buildRectTransform(node.rectId, node.gameObjectId, rectProps, node.children.map(c => c.rectId), parentRectId);
      
      // 递归处理子节点，传递当前节点的中心点
      if (node.children.length > 0) {
        this.generateTransforms(node.children, node.rectId, { cx: nodeCenterX, cy: nodeCenterY });
      }
    }
  }

  // 阶段3：生成所有其他组件
  private generateComponents(nodes: PrefabNode[]) {
    for (const node of nodes) {
      if (node.canvasRendererId) {
        this.builder.buildCanvasRenderer(node.canvasRendererId, node.gameObjectId);
      }
      
      if (node.info.type === 'Image' && node.componentId) {
        const border = node.info.border || node.sprite?.border;
        // 只有当 border 存在且至少有一个非零值时，才使用 Sliced (1)，否则使用 Simple (0)
        const hasBorder = border && border.some(v => v > 0);
        const type = hasBorder ? 1 : 0;
        
        // Image使用白色作为基础色，应用图层透明度
        // 回退：恢复使用图层透明度，因为有些图片可能需要半透明效果，且 PNG 导出时可能未包含正确的 Alpha
        const imageColor = { r: 1, g: 1, b: 1, a: node.layer.opacity };
        this.builder.buildImage(node.componentId, node.gameObjectId, node.sprite?.guid || '', type, imageColor);
      } else if (node.info.type === 'Text' && node.componentId && node.layer.textInfo) {
        const t = node.layer.textInfo;
        
        // 处理多颜色文本
        const { mainColor, richText } = this.processMultiColorText(t);
        const finalColor = this.hexToColor(mainColor, node.layer.opacity);
        
        // 查找字体 GUID
        let fontGuid: string | undefined;
        if (this.fontMap && t.fontFamily) {
          // 1. 尝试完全匹配
          fontGuid = this.fontMap.get(t.fontFamily);
          // 2. 尝试小写匹配
          if (!fontGuid) fontGuid = this.fontMap.get(t.fontFamily.toLowerCase());
          // 3. 尝试去除空格匹配 (Microsoft YaHei -> microsoftyahei)
          if (!fontGuid) fontGuid = this.fontMap.get(t.fontFamily.replace(/\s+/g, '').toLowerCase());
          
          // 如果还是没找到，但是 fontMap 里只有一个字体，那就用它 (用户指定了单一字体)
          if (!fontGuid && this.fontMap.size > 0 && this.fontMap.size <= 2) { 
             // 为什么是 <=2? 因为我们会存大小写等变体，size 可能虚高。
             // 更准确的做法是检查有多少个 unique guid。
             // 这里简单处理：如果没匹配到，且用户提供了字体目录，可能就是想用里面的字体。
             // 我们可以获取第一个 value。
             const firstGuid = this.fontMap.values().next().value;
             if (firstGuid) fontGuid = firstGuid;
          }
        }
        
        // 计算 FontStyle (0=Normal, 1=Bold, 2=Italic, 3=BoldItalic)
        let fontStyle = 0;
        if (t.bold) fontStyle |= 1;
        if (t.italic) fontStyle |= 2;
        
        this.builder.buildText(
          node.componentId, 
          node.gameObjectId, 
          richText, 
          Math.round(t.fontSize), 
          finalColor, 
          t.textAlign || 'center', // 强制居中对齐 (配合 generateTransforms 的中心定位)
          fontGuid,
          fontStyle
        );
        
        // 如果文本有描边，添加 Outline 组件
        // 描边可能来自 textInfo（文本样式）或 effects（图层效果）
        const textStyleStroke = t.strokeColor && t.strokeWidth ? { color: t.strokeColor, width: t.strokeWidth } : null;
        const effectStroke = node.layer.effects?.stroke?.[0] ? { 
          color: node.layer.effects.stroke[0].color, 
          width: node.layer.effects.stroke[0].width 
        } : null;
        const strokeInfo = textStyleStroke || effectStroke;
        
        console.log(`[PrefabGenerator] Checking outline for "${node.layer.name}": outlineId=${node.outlineId}, textStyleStroke=${!!textStyleStroke}, effectStroke=${!!effectStroke}`);
        
        if (node.outlineId && strokeInfo) {
          const strokeColor = this.hexToColor(strokeInfo.color, node.layer.opacity);
          // effectDistance 基于 strokeWidth，默认 1px 描边距离
          const distance = Math.max(1, Math.round(strokeInfo.width / 2));
          console.log(`[PrefabGenerator] Building Outline for "${node.layer.name}" with color:`, strokeColor, `distance: ${distance}`);
          this.builder.buildOutline(node.outlineId, node.gameObjectId, strokeColor, {x: distance, y: -distance});
        } else {
          console.log(`[PrefabGenerator] Skipping outline for "${node.layer.name}" - no stroke info found`);
        }
      }
      
      if (node.children.length > 0) this.generateComponents(node.children);
    }
  }

  /**
   * 处理多颜色文本
   * 返回：主色（占比最高的颜色）和带 color 标签的富文本
   */
  private processMultiColorText(textInfo: any): { mainColor: string, richText: string } {
    const { text, color: defaultColor, styleRuns } = textInfo;
    
    // 如果没有 styleRuns 或只有一个颜色，直接返回
    if (!styleRuns || styleRuns.length <= 1) {
      return { mainColor: defaultColor || '#000000', richText: text };
    }
    
    // 统计各颜色的字符数
    const colorCount: Map<string, number> = new Map();
    for (const run of styleRuns) {
      const runColor = run.color || defaultColor || '#000000';
      const count = colorCount.get(runColor) || 0;
      colorCount.set(runColor, count + run.text.length);
    }
    
    // 找出占比最高的颜色作为主色
    let mainColor = defaultColor || '#000000';
    let maxCount = 0;
    for (const [runColor, count] of colorCount.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mainColor = runColor;
      }
    }
    
    // 生成带 color 标签的富文本
    let richText = '';
    for (const run of styleRuns) {
      const runColor = run.color || defaultColor || '#000000';
      if (runColor.toLowerCase() === mainColor.toLowerCase()) {
        // 主色不添加标签
        richText += run.text;
      } else {
        // 其他颜色添加 <color> 标签
        // Unity 支持十六进制颜色格式：<color=#RRGGBB>text</color>
        richText += `<color=${runColor}>${run.text}</color>`;
      }
    }
    
    console.log(`[PrefabGenerator] Multi-color text processed:`, {
      original: text,
      mainColor,
      richText,
      colorCount: Object.fromEntries(colorCount)
    });
    
    return { mainColor, richText };
  }

  private hexToColor(hex: string, opacity: number = 1) {
    if (hex.startsWith('#')) hex = hex.substring(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    return {
      r: parseInt(hex.substring(0, 2), 16) / 255,
      g: parseInt(hex.substring(2, 4), 16) / 255,
      b: parseInt(hex.substring(4, 6), 16) / 255,
      a: opacity
    };
  }

  public generate(layers: PsdLayer[], viewName: string): string {
    const rootNodes = this.buildNodeTree(layers);
    
    const rootId = this.generateId();
    const rootRectId = this.generateId();
    
    // 阶段1：GameObjects
    this.builder.buildGameObject(rootId, viewName, [rootRectId], true);
    this.generateGameObjects(rootNodes);
    
    // 阶段2：RectTransforms
    this.builder.buildRectTransform(rootRectId, rootId, {
      anchorMin: { x: 0.5, y: 0.5 },
      anchorMax: { x: 0.5, y: 0.5 },
      anchoredPosition: { x: 0, y: 0 },
      sizeDelta: { x: this.width, y: this.height },
      pivot: { x: 0.5, y: 0.5 }
    }, rootNodes.map(n => n.rectId), '0');
    
    // 根节点的中心点
    const rootCenterX = this.width / 2;
    const rootCenterY = this.height / 2;
    this.generateTransforms(rootNodes, rootRectId, { cx: rootCenterX, cy: rootCenterY });
    
    // 阶段3：其他组件
    this.generateComponents(rootNodes);

    return this.builder.toString();
  }
}
