import type { PsdLayer } from '../../types/psd';

/**
 * 图层渲染器 (用于导出时烘焙效果)
 * 提取自 CanvasViewer 并增强了渐变叠加支持
 */

export class LayerRenderer {
  private tempCanvas: HTMLCanvasElement;
  private strokeCanvas: HTMLCanvasElement;
  private maskCanvas: HTMLCanvasElement;

  constructor() {
    this.tempCanvas = document.createElement('canvas');
    this.strokeCanvas = document.createElement('canvas');
    this.maskCanvas = document.createElement('canvas');
  }

  private getCanvas(name: 'temp' | 'stroke' | 'mask', width: number, height: number): HTMLCanvasElement {
    const canvas = name === 'temp' ? this.tempCanvas : name === 'stroke' ? this.strokeCanvas : this.maskCanvas;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return canvas;
  }

  /**
   * 烘焙图层效果到一个新的 Canvas 上
   */
  public async bakeLayer(layer: PsdLayer): Promise<HTMLCanvasElement | null> {
    if (!layer.canvas) return null;

    const { left, top, right, bottom } = layer.bounds;
    const width = right - left;
    const height = bottom - top;

    if (width <= 0 || height <= 0) return null;

    // 效果检查
    const hasDropShadow = !!layer.effects?.dropShadow?.[0];
    const hasStroke = !!layer.effects?.stroke?.[0];
    const hasGradient = !!layer.effects?.gradientOverlay?.[0];
    const hasMask = !!(layer.mask && layer.mask.canvas && !layer.mask.disabled);

    if (!hasDropShadow && !hasStroke && !hasGradient && !hasMask) {
      return layer.canvas; // 无效果，直接返回原始
    }

    // 计算 padding (为描边和投影留出空间)
    const strokeWidth = hasStroke ? layer.effects!.stroke![0].width : 0;
    const shadowBlur = hasDropShadow ? layer.effects!.dropShadow![0].blur : 0;
    const shadowDistance = hasDropShadow ? layer.effects!.dropShadow![0].distance : 0;
    const padding = Math.max(strokeWidth * 2, shadowBlur + shadowDistance);

    const fullWidth = width + padding * 2;
    const fullHeight = height + padding * 2;

    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = fullWidth;
    resultCanvas.height = fullHeight;
    const ctx = resultCanvas.getContext('2d');
    if (!ctx) return null;

    // 1. 处理遮罩后的内容
    let contentCanvas: HTMLCanvasElement = layer.canvas;
    if (hasMask) {
      const maskTemp = this.getCanvas('mask', width, height);
      const mctx = maskTemp.getContext('2d')!;
      mctx.clearRect(0, 0, width, height);
      mctx.drawImage(layer.canvas, 0, 0);
      mctx.globalCompositeOperation = 'destination-in';
      const maskOffsetX = layer.mask!.bounds.left - left;
      const maskOffsetY = layer.mask!.bounds.top - top;
      mctx.drawImage(layer.mask!.canvas!, maskOffsetX, maskOffsetY);
      
      // 创建一个持久的 canvas 存放遮罩结果
      const maskedContent = document.createElement('canvas');
      maskedContent.width = width;
      maskedContent.height = height;
      maskedContent.getContext('2d')!.drawImage(maskTemp, 0, 0);
      contentCanvas = maskedContent;
    }

    // 2. 绘制描边 (使用原始形状，不包含遮罩)
    if (hasStroke) {
      this.renderStroke(ctx, layer.canvas, layer.effects!.stroke![0], padding);
    }

    // 3. 绘制投影
    if (hasDropShadow) {
      this.renderDropShadow(ctx, contentCanvas, layer.effects!.dropShadow![0], padding);
    }

    // 4. 绘制主体内容 (含渐变叠加)
    ctx.save();
    ctx.translate(padding, padding);
    
    if (hasGradient) {
      // 渐变叠加：先画内容，然后用 source-in 画渐变
      const gradCanvas = document.createElement('canvas');
      gradCanvas.width = width;
      gradCanvas.height = height;
      const gctx = gradCanvas.getContext('2d')!;
      
      // 1. 画基础形状
      gctx.drawImage(contentCanvas, 0, 0);
      
      // 2. 应用渐变
      gctx.globalCompositeOperation = 'source-in';
      const overlay = layer.effects!.gradientOverlay![0];
      const gradient = this.createCanvasGradient(gctx, width, height, overlay);
      gctx.fillStyle = gradient;
      gctx.globalAlpha = overlay.opacity;
      gctx.fillRect(0, 0, width, height);
      
      ctx.drawImage(gradCanvas, 0, 0);
    } else {
      ctx.drawImage(contentCanvas, 0, 0);
    }
    
    ctx.restore();

    return resultCanvas;
  }

  private renderStroke(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, effect: any, padding: number) {
    const { color, width: strokeWidth } = effect;
    const directions = 32;
    const expandedWidth = source.width + padding * 2;
    const expandedHeight = source.height + padding * 2;
    
    const strokeCanvas = this.getCanvas('stroke', expandedWidth, expandedHeight);
    const sctx = strokeCanvas.getContext('2d')!;
    sctx.clearRect(0, 0, expandedWidth, expandedHeight);

    // 膨胀法渲染描边
    for (let i = 0; i < directions; i++) {
      const angle = (i / directions) * Math.PI * 2;
      const offX = Math.cos(angle) * strokeWidth;
      const offY = Math.sin(angle) * strokeWidth;
      sctx.drawImage(source, padding + offX, padding + offY);
    }

    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = color;
    sctx.fillRect(0, 0, expandedWidth, expandedHeight);
    
    // 挖洞
    sctx.globalCompositeOperation = 'destination-out';
    sctx.drawImage(source, padding, padding);
    
    ctx.drawImage(strokeCanvas, 0, 0);
  }

  private renderDropShadow(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, effect: any, padding: number) {
    const { color, opacity, angle, distance, blur } = effect;
    const rad = (angle * Math.PI) / 180;
    
    ctx.save();
    // 简易 Hex 转 RGBA
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = Math.cos(rad) * distance;
    ctx.shadowOffsetY = Math.sin(rad) * distance;
    
    ctx.drawImage(source, padding, padding);
    ctx.restore();
  }

  private createCanvasGradient(ctx: CanvasRenderingContext2D, w: number, h: number, overlay: any) {
    const { angle, gradient } = overlay;
    const rad = (angle * Math.PI) / 180;
    
    // 计算渐变起止点
    const cx = w / 2;
    const cy = h / 2;
    const length = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
    
    const x0 = cx - (Math.cos(rad) * length) / 2;
    const y0 = cy - (Math.sin(rad) * length) / 2;
    const x1 = cx + (Math.cos(rad) * length) / 2;
    const y1 = cy + (Math.sin(rad) * length) / 2;

    const canvasGrad = ctx.createLinearGradient(x0, y0, x1, y1);
    
    // 添加颜色和透明度停靠点
    // PS 的渐变通常比较复杂，这里做一个简单的合并
    const stops = gradient.colorStops.map((cs: any) => {
       const os = gradient.opacityStops.find((o: any) => Math.abs(o.location - cs.location) < 0.01) || { opacity: 1 };
       return { 
         offset: cs.location / 4096, // ag-psd location range 0-4096
         color: cs.color,
         opacity: os.opacity
       };
    });

    stops.forEach((s: any) => {
       const hex = s.color.replace('#', '');
       const r = parseInt(hex.substring(0, 2), 16);
       const g = parseInt(hex.substring(2, 4), 16);
       const b = parseInt(hex.substring(4, 6), 16);
       canvasGrad.addColorStop(s.offset, `rgba(${r},${g},${b},${s.opacity})`);
    });

    return canvasGrad;
  }
}
