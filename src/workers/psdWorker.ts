import { readPsd, initializeCanvas } from 'ag-psd';

// 在 Worker 中初始化 Canvas 创建方法
// Worker 没有 DOM，使用 OffscreenCanvas
initializeCanvas(
  (width, height) => {
    const canvas = new OffscreenCanvas(width, height);
    // ag-psd 期望 HTMLCanvasElement，但 OffscreenCanvas 兼容大部分 API
    return canvas as unknown as HTMLCanvasElement;
  },
  (width, height) => {
    // 创建 ImageData
    return new ImageData(width, height);
  }
);

// Worker 消息类型
interface WorkerMessage {
  type: 'parse' | 'parseLayerImage';
  id: string;
  buffer?: ArrayBuffer;
  layerPath?: number[]; // 图层路径（用于按需加载）
}

interface WorkerResponse {
  type: 'parsed' | 'layerImage' | 'error' | 'progress';
  id: string;
  data?: unknown;
  error?: string;
  progress?: number;
}

/**
 * 解析完整 PSD（包含像素数据）
 * 用于需要渲染的场景
 */
function parsePsdFull(buffer: ArrayBuffer) {
  
  const psd = readPsd(buffer, {
    skipLayerImageData: false,
    skipCompositeImageData: false,
    skipThumbnail: true,
  });
  
  // 使用 as unknown as 绕过类型检查 (Psd 类型与 Record<string, unknown> 不兼容)
  return convertPsdToSerializableWithImages(psd as unknown as Record<string, unknown>);
}

/**
 * RGB 颜色转 HEX
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * 从颜色对象提取 HEX
 */
function colorToHex(color: unknown): string {
  if (!color || typeof color !== 'object') return '#000000';
  const c = color as Record<string, unknown>;
  if ('r' in c && 'g' in c && 'b' in c) {
    return rgbToHex(Number(c.r) || 0, Number(c.g) || 0, Number(c.b) || 0);
  }
  if ('fr' in c && 'fg' in c && 'fb' in c) {
    return rgbToHex(
      (Number(c.fr) || 0) * 255,
      (Number(c.fg) || 0) * 255,
      (Number(c.fb) || 0) * 255
    );
  }
  return '#000000';
}

/**
 * 解析 UnitsValue
 */
function unitsValueToNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return Number((value as { value: unknown }).value) || 0;
  }
  return 0;
}

let layerIdCounter = 0;

/**
 * 判断图层类型
 * 注意：shape 类型统一当成 image 处理
 */
function getLayerType(layer: Record<string, unknown>): string {
  if (layer.text) return 'text';
  if (layer.children && (layer.children as unknown[]).length > 0) return 'group';
  if (layer.placedLayer) return 'image';
  // shape 类型（vectorMask/vectorFill/vectorStroke）统一当成 image 处理
  if (layer.vectorMask || layer.vectorFill || layer.vectorStroke) return 'image';
  if (layer.adjustment) return 'adjustment';
  if (layer.canvas) return 'image';
  return 'unknown';
}

/**
 * 转换图层为可序列化格式（不含 Canvas）
 */
function convertLayerSerializable(layer: Record<string, unknown>, psd: Record<string, unknown>): Record<string, unknown> {
  const type = getLayerType(layer);
  
  // ag-psd 返回的 opacity 范围可能是 0-1 或 0-255，需要归一化
  let opacity = (layer.opacity as number) ?? 1;
  if (opacity > 1) {
    opacity = opacity / 255;
  }
  
  const result: Record<string, unknown> = {
    id: `layer_${++layerIdCounter}_${Date.now()}`,
    name: layer.name || 'Unnamed Layer',
    type,
    bounds: {
      top: layer.top ?? 0,
      left: layer.left ?? 0,
      bottom: layer.bottom ?? 0,
      right: layer.right ?? 0,
    },
    visible: !layer.hidden,
    opacity,
    blendMode: layer.blendMode,
    hasImageData: !!layer.canvas, // 标记是否有图像数据
  };
  
  // 提取效果
  if (layer.effects) {
    result.effects = extractEffectsSerializable(layer.effects as Record<string, unknown>);
  }
  
  // 提取文本信息
  if (type === 'text' && layer.text) {
    result.textInfo = extractTextInfoSerializable(layer.text as Record<string, unknown>);
  }
  
  // 提取图片信息
  if (type === 'image') {
    result.imageInfo = extractImageInfoSerializable(layer, psd);
  }
  
  // 递归处理子图层
  if (layer.children && (layer.children as unknown[]).length > 0) {
    result.children = (layer.children as Record<string, unknown>[]).map(child => 
      convertLayerSerializable(child, psd)
    );
  }
  
  return result;
}

/**
 * 转换图层为可序列化格式（含图像数据）
 */
function convertLayerWithImage(layer: Record<string, unknown>, psd: Record<string, unknown>): Record<string, unknown> {
  const result = convertLayerSerializable(layer, psd);
  
  // 如果有 canvas，转换为 ImageData
  // 在 Worker 中，canvas 实际上是 OffscreenCanvas
  if (layer.canvas) {
    const canvas = layer.canvas as OffscreenCanvas;
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      result.imageData = {
        width: canvas.width,
        height: canvas.height,
        data: imageData.data.buffer, // ArrayBuffer，可转移
      };
    }
  }
  
  // 处理遮罩
  const mask = layer.mask as Record<string, unknown> | undefined;
  if (mask && !mask.disabled && mask.canvas) {
    const maskCanvas = mask.canvas as OffscreenCanvas;
    const maskCtx = maskCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (maskCtx) {
      const maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      result.maskData = {
        width: maskCanvas.width,
        height: maskCanvas.height,
        data: maskImageData.data.buffer,
        bounds: {
          top: mask.top ?? 0,
          left: mask.left ?? 0,
          bottom: mask.bottom ?? 0,
          right: mask.right ?? 0,
        },
        disabled: mask.disabled,
        defaultColor: mask.defaultColor,
      };
    }
  }
  
  // 递归处理子图层
  if (layer.children && (layer.children as unknown[]).length > 0) {
    result.children = (layer.children as Record<string, unknown>[]).map(child => 
      convertLayerWithImage(child, psd)
    );
  }
  
  return result;
}

function extractTextInfoSerializable(text: Record<string, unknown>): Record<string, unknown> {
  const style = (text.style || {}) as Record<string, unknown>;
  const font = style.font as Record<string, unknown> | undefined;
  
  let color = '#000000';
  if (style.fillColor) {
    color = colorToHex(style.fillColor);
  }
  
  let strokeColor: string | undefined;
  if (style.strokeColor) {
    strokeColor = colorToHex(style.strokeColor);
  }
  
  return {
    text: text.text || '',
    fontFamily: font?.name || 'Unknown',
    fontSize: style.fontSize || 12,
    color,
    strokeColor,
    strokeWidth: style.strokeWidth,
    lineHeight: style.leading,
    letterSpacing: style.tracking ? (style.tracking as number) / 1000 : undefined,
    textAlign: (text.paragraphStyle as Record<string, unknown>)?.justification,
    bold: style.fauxBold,
    italic: style.fauxItalic,
    underline: style.underline,
  };
}

function extractImageInfoSerializable(layer: Record<string, unknown>, _psd: Record<string, unknown>): Record<string, unknown> {
  const info: Record<string, unknown> = {
    name: layer.name || 'Unnamed',
  };
  
  if (layer.placedLayer) {
    const placed = layer.placedLayer as Record<string, unknown>;
    info.originalWidth = placed.width;
    info.originalHeight = placed.height;
  }
  
  return info;
}

function extractEffectsSerializable(effects: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  if (effects.dropShadow) {
    result.dropShadow = (effects.dropShadow as Record<string, unknown>[]).map(shadow => ({
      color: colorToHex(shadow.color),
      opacity: shadow.opacity ?? 1,
      angle: shadow.angle ?? 120,
      distance: unitsValueToNumber(shadow.distance),
      blur: unitsValueToNumber(shadow.blur ?? shadow.size ?? 5),
    }));
  }
  
  if (effects.stroke) {
    result.stroke = (effects.stroke as Record<string, unknown>[]).map(stroke => ({
      color: colorToHex(stroke.color),
      width: unitsValueToNumber(stroke.size),
      position: stroke.position || 'outside',
    }));
  }
  
  if (effects.innerShadow) {
    result.innerShadow = (effects.innerShadow as Record<string, unknown>[]).map(shadow => ({
      color: colorToHex(shadow.color),
      opacity: shadow.opacity ?? 1,
      angle: shadow.angle ?? 120,
      distance: unitsValueToNumber(shadow.distance),
      blur: unitsValueToNumber(shadow.blur ?? shadow.size ?? 5),
    }));
  }
  
  return Object.keys(result).length > 0 ? result : {};
}

function convertPsdToSerializableWithImages(psd: Record<string, unknown>): Record<string, unknown> {
  layerIdCounter = 0;
  
  const result: Record<string, unknown> = {
    width: psd.width,
    height: psd.height,
    layers: ((psd.children || []) as Record<string, unknown>[]).map(layer => 
      convertLayerWithImage(layer, psd)
    ),
  };
  
  // 合成图像
  // 在 Worker 中，canvas 实际上是 OffscreenCanvas
  if (psd.canvas) {
    const canvas = psd.canvas as OffscreenCanvas;
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      result.compositeImage = {
        width: canvas.width,
        height: canvas.height,
        data: imageData.data.buffer,
      };
    }
  }
  
  return result;
}

// Worker 消息处理
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, id, buffer } = e.data;
  
  try {
    if (type === 'parse' && buffer) {
      // 解析完整 PSD（包含像素数据）
      const result = parsePsdFull(buffer);
      
      // 收集可转移的 ArrayBuffer
      const transferables: ArrayBuffer[] = [];
      collectTransferables(result, transferables);
      
      // Worker 上下文的 postMessage 支持 transferables
      (self as unknown as { postMessage(message: unknown, transfer: Transferable[]): void })
        .postMessage({ type: 'parsed', id, data: result } as WorkerResponse, transferables);
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      id, 
      error: (error as Error).message 
    } as WorkerResponse);
  }
};

/**
 * 收集所有可转移的 ArrayBuffer
 */
function collectTransferables(obj: unknown, transferables: ArrayBuffer[]) {
  if (!obj || typeof obj !== 'object') return;
  
  if (obj instanceof ArrayBuffer) {
    transferables.push(obj);
    return;
  }
  
  const record = obj as Record<string, unknown>;
  
  if (record.data instanceof ArrayBuffer) {
    transferables.push(record.data);
  }
  
  if (record.imageData && typeof record.imageData === 'object') {
    const imgData = record.imageData as Record<string, unknown>;
    if (imgData.data instanceof ArrayBuffer) {
      transferables.push(imgData.data);
    }
  }
  
  // 收集遮罩数据
  if (record.maskData && typeof record.maskData === 'object') {
    const maskData = record.maskData as Record<string, unknown>;
    if (maskData.data instanceof ArrayBuffer) {
      transferables.push(maskData.data);
    }
  }
  
  if (record.compositeImage && typeof record.compositeImage === 'object') {
    const compImg = record.compositeImage as Record<string, unknown>;
    if (compImg.data instanceof ArrayBuffer) {
      transferables.push(compImg.data);
    }
  }
  
  if (Array.isArray(record.layers)) {
    for (const layer of record.layers) {
      collectTransferables(layer, transferables);
    }
  }
  
  if (Array.isArray(record.children)) {
    for (const child of record.children) {
      collectTransferables(child, transferables);
    }
  }
}

export {};
