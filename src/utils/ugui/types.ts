import type { NamingRules } from '../../stores/configStore';

export interface SpriteInfo {
  name: string;      // Sprite name (without extension)
  guid: string;      // Unity GUID from .meta
  fileID: string;    // Unity FileID (usually 21300000 for Sprite)
  border?: [number, number, number, number]; // Left, Bottom, Right, Top
  handle?: FileSystemFileHandle; // Handle to the image file
  metaHandle?: FileSystemFileHandle; // Handle to the .meta file
}

export interface UGUIConfig {
  enabled: boolean;
  spriteDirectory?: string;
  prefabOutputDirectory?: string;
  namingRules?: NamingRules;
  pixelsPerUnit: number; // Default 100
}

export interface UGUINodeInfo {
  originalName: string;
  exportName: string;
  type: 'Image' | 'Text' | 'Group';
  noExport: boolean;
  border?: [number, number, number, number]; // 9-slice from name
  targetSize?: { width: number, height: number }; // @9#w,h_t,r,b,l
}
