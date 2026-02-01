// PSD 文档
export interface PsdDocument {
  width: number;
  height: number;
  layers: PsdLayer[];
  canvas?: HTMLCanvasElement; // 合成后的完整画布
}

// 图层类型
export type LayerType = 'text' | 'image' | 'group' | 'shape' | 'adjustment' | 'unknown';

// 图层边界
export interface LayerBounds {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

// 文本图层信息
export interface TextLayerInfo {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string; // HEX 格式 如 #FF5733
  strokeColor?: string;
  strokeWidth?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

// 图片/智能对象图层信息
export interface ImageLayerInfo {
  name: string;
  linkedFileName?: string; // 智能对象链接的文件名
  originalWidth?: number;
  originalHeight?: number;
}

// 图层效果
export interface LayerEffects {
  dropShadow?: {
    color: string;
    opacity: number;
    angle: number;
    distance: number;
    blur: number;
  }[];
  stroke?: {
    color: string;
    width: number;
    position: 'inside' | 'center' | 'outside';
  }[];
  innerShadow?: {
    color: string;
    opacity: number;
    angle: number;
    distance: number;
    blur: number;
  }[];
}

// 图层
export interface PsdLayer {
  id: string;
  name: string;
  type: LayerType;
  bounds: LayerBounds;
  visible: boolean;
  opacity: number; // 0-1
  blendMode?: string;
  children?: PsdLayer[]; // 仅 group 类型有
  textInfo?: TextLayerInfo; // 仅 text 类型有
  imageInfo?: ImageLayerInfo; // 仅 image 类型有
  effects?: LayerEffects;
  canvas?: HTMLCanvasElement; // 图层的渲染结果
}

// 主题类型
export type Theme = 'light' | 'dark';

// 计算属性：图层宽高
export function getLayerSize(bounds: LayerBounds): { width: number; height: number } {
  return {
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
  };
}
