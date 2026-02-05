// FGUI 导出相关类型定义

export type ComponentType = 'Component' | 'Button' | 'Label' | 'ProgressBar' | 'Slider' | 'ScrollBar' | 'ComboBox' | 'List';

export interface FguiResource {
  id: string;
  name: string;
  type: string;
  path?: string;
  exported?: boolean;
}

export interface FguiPackageInfo {
  name: string; // 包名 (PSD名 @ 前的部分)
  desc?: string; // 描述 (PSD名 @ 后的部分)
}

export interface FguiNodeInfo {
  // 原始信息
  originalName: string;
  
  // 导出信息
  exportName: string; // 文件名 (PascalCase)
  nodeName?: string; // 实例名 (camelCase)
  type: ComponentType | 'Image' | 'Graph' | 'Group' | 'Text' | 'Loader';
  
  // 属性
  isCommon: boolean; // 是否 Common@ 开头
  isExported: boolean; // 是否作为组件导出（Com$, Btn$ 等）
  
  // 特殊后缀属性
  isTitle?: boolean; // @title
  isImg?: boolean; // @img (Loader)
  scale9Grid?: number[]; // @9#t_r_b_l
  isBarBg?: boolean; // @barbg
  isBar?: boolean; // @bar
  noExport?: boolean; // @NoExport
  
  // 资源引用
  assetPath?: string; // 图片资源路径
  packageId?: string; // 包 ID (FGUI生成)
  id?: string; // 组件/资源 ID
}

export interface ExportContext {
  packageName: string;
  commonPackageName: string;
  singlePackageName: string;
  largeImageThreshold: number;
}
