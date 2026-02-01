import { readPsd } from 'ag-psd';
import type { Psd, Layer } from 'ag-psd';
import type {
  PsdDocument,
  PsdLayer,
  LayerType,
  TextLayerInfo,
  ImageLayerInfo,
  LayerEffects,
} from '../types/psd';

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
 * 从 ag-psd 颜色对象提取 HEX 颜色
 */
function colorToHex(color: unknown): string {
  if (!color || typeof color !== 'object') return '#000000';
  const c = color as Record<string, unknown>;
  // 尝试 RGB 格式 (0-255)
  if ('r' in c && 'g' in c && 'b' in c) {
    return rgbToHex(
      Number(c.r) || 0,
      Number(c.g) || 0,
      Number(c.b) || 0
    );
  }
  // 尝试 FRGB 格式 (0-1)
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
 * 解析 UnitsValue 为数字
 */
function unitsValueToNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return Number((value as { value: unknown }).value) || 0;
  }
  return 0;
}

/**
 * 生成唯一 ID
 */
let layerIdCounter = 0;
function generateLayerId(): string {
  return `layer_${++layerIdCounter}_${Date.now()}`;
}

/**
 * 判断图层类型
 */
function getLayerType(layer: Layer): LayerType {
  if (layer.text) {
    return 'text';
  }
  if (layer.children && layer.children.length > 0) {
    return 'group';
  }
  if (layer.placedLayer) {
    return 'image'; // 智能对象
  }
  if (layer.vectorMask || layer.vectorFill || layer.vectorStroke) {
    return 'shape';
  }
  if (layer.adjustment) {
    return 'adjustment';
  }
  if (layer.canvas) {
    return 'image';
  }
  return 'unknown';
}

/**
 * 提取文本图层信息
 */
function extractTextInfo(layer: Layer): TextLayerInfo | undefined {
  if (!layer.text) return undefined;

  const text = layer.text;
  const style = text.style || {};
  const font = (style as Record<string, unknown>).font as Record<string, unknown> | undefined;

  // 获取填充颜色
  let color = '#000000';
  if (style.fillColor) {
    color = colorToHex(style.fillColor);
  }

  // 获取描边颜色
  let strokeColor: string | undefined;
  if ((style as Record<string, unknown>).strokeColor) {
    strokeColor = colorToHex((style as Record<string, unknown>).strokeColor);
  }

  return {
    text: text.text || '',
    fontFamily: (font?.name as string) || 'Unknown',
    fontSize: style.fontSize || 12,
    color,
    strokeColor,
    strokeWidth: (style as Record<string, unknown>).strokeWidth as number | undefined,
    lineHeight: style.leading,
    letterSpacing: style.tracking ? style.tracking / 1000 : undefined,
    textAlign: text.paragraphStyle?.justification as TextLayerInfo['textAlign'],
    bold: style.fauxBold,
    italic: style.fauxItalic,
    underline: style.underline,
  };
}

/**
 * 提取图片/智能对象信息
 */
function extractImageInfo(layer: Layer, psd: Psd): ImageLayerInfo | undefined {
  const info: ImageLayerInfo = {
    name: layer.name || 'Unnamed',
  };

  // 如果是智能对象
  if (layer.placedLayer) {
    const placed = layer.placedLayer;
    info.originalWidth = placed.width;
    info.originalHeight = placed.height;

    // 查找链接文件
    if (psd.linkedFiles && placed.id) {
      const linkedFile = psd.linkedFiles.find(f => f.id === placed.id);
      if (linkedFile) {
        info.linkedFileName = linkedFile.name;
      }
    }
  }

  return info;
}

/**
 * 提取图层效果
 */
function extractEffects(layer: Layer): LayerEffects | undefined {
  if (!layer.effects) return undefined;

  const effects: LayerEffects = {};

  // 阴影
  if (layer.effects.dropShadow) {
    effects.dropShadow = layer.effects.dropShadow.map(shadow => ({
      color: colorToHex(shadow.color),
      opacity: shadow.opacity ?? 1,
      angle: shadow.angle ?? 120,
      distance: unitsValueToNumber(shadow.distance),
      blur: unitsValueToNumber((shadow as Record<string, unknown>).blur ?? (shadow as Record<string, unknown>).size ?? 5),
    }));
  }

  // 描边
  if (layer.effects.stroke) {
    effects.stroke = layer.effects.stroke.map(stroke => ({
      color: colorToHex(stroke.color),
      width: unitsValueToNumber(stroke.size),
      position: (stroke.position as 'inside' | 'center' | 'outside') || 'outside',
    }));
  }

  // 内阴影
  if (layer.effects.innerShadow) {
    effects.innerShadow = layer.effects.innerShadow.map(shadow => ({
      color: colorToHex(shadow.color),
      opacity: shadow.opacity ?? 1,
      angle: shadow.angle ?? 120,
      distance: unitsValueToNumber(shadow.distance),
      blur: unitsValueToNumber((shadow as Record<string, unknown>).blur ?? (shadow as Record<string, unknown>).size ?? 5),
    }));
  }

  return Object.keys(effects).length > 0 ? effects : undefined;
}

/**
 * 递归转换图层
 */
function convertLayer(layer: Layer, psd: Psd): PsdLayer {
  const type = getLayerType(layer);

  const result: PsdLayer = {
    id: generateLayerId(),
    name: layer.name || 'Unnamed Layer',
    type,
    bounds: {
      top: layer.top ?? 0,
      left: layer.left ?? 0,
      bottom: layer.bottom ?? 0,
      right: layer.right ?? 0,
    },
    visible: !layer.hidden,
    opacity: layer.opacity ?? 1,
    blendMode: layer.blendMode,
    canvas: layer.canvas,
    effects: extractEffects(layer),
  };

  // 添加类型特定信息
  if (type === 'text') {
    result.textInfo = extractTextInfo(layer);
  } else if (type === 'image') {
    result.imageInfo = extractImageInfo(layer, psd);
  }

  // 递归处理子图层
  if (layer.children && layer.children.length > 0) {
    result.children = layer.children.map(child => convertLayer(child, psd));
  }

  return result;
}

/**
 * 解析 PSD 文件
 * @param buffer ArrayBuffer 或 Uint8Array
 * @returns PsdDocument
 */
export function parsePsd(buffer: ArrayBuffer | Uint8Array): PsdDocument {
  // 重置计数器
  layerIdCounter = 0;

  // 解析 PSD
  const psd = readPsd(buffer, {
    skipLayerImageData: false,
    skipCompositeImageData: false,
    skipThumbnail: true,
  });

  // 转换图层
  const layers: PsdLayer[] = (psd.children || []).map(layer => convertLayer(layer, psd));

  return {
    width: psd.width,
    height: psd.height,
    layers,
    canvas: psd.canvas,
  };
}

/**
 * 从 File 对象解析 PSD
 */
export async function parsePsdFromFile(file: File): Promise<PsdDocument> {
  const buffer = await file.arrayBuffer();
  return parsePsd(buffer);
}

/**
 * 检查文件大小并给出警告
 */
export function checkFileSizeWarning(size: number): string | null {
  const mb = size / (1024 * 1024);
  if (mb > 200) {
    return `文件较大 (${mb.toFixed(1)} MB)，解析可能需要较长时间`;
  }
  if (mb > 100) {
    return `文件较大 (${mb.toFixed(1)} MB)，可能需要稍等片刻`;
  }
  return null;
}
