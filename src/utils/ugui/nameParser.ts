import type { NamingRules } from '../../stores/configStore';
import type { UGUINodeInfo } from './types';

const DEFAULT_SUFFIXES = {
  noExport: '@NoExport',
  text: '@txt', 
};

export function parseLayerName(layerName: string, layerType?: string, rules?: NamingRules): UGUINodeInfo {
  // Truncate at first space (ignore comments/metadata after space)
  const originalInputName = layerName;
  layerName = layerName.trim().split(' ')[0];

  const result: UGUINodeInfo = {
    originalName: originalInputName,
    exportName: layerName,
    type: 'Image',
    noExport: false,
  };
  
  // 如果图层本身就是文本类型，强制设为 Text
  if (layerType === 'text') {
    result.type = 'Text';
  }
  
  // 移除强制 Group 类型判断，改由 prefabGenerator 根据是否有 canvas 来判断
  // if (layerType === 'group') {
  //   result.type = 'Group';
  // }

  const noExportSuffix = rules?.suffixes?.noExport || DEFAULT_SUFFIXES.noExport;
  // Use 'input' suffix key from config if available, or default
  const textSuffix = rules?.suffixes?.input || DEFAULT_SUFFIXES.text; 

  // 1. Check @NoExport
  if (layerName.endsWith(noExportSuffix)) {
    result.noExport = true;
    result.exportName = layerName.substring(0, layerName.length - noExportSuffix.length);
  }

  // 2. Check @txt (Force Text)
  if (result.exportName.endsWith(textSuffix)) {
    result.type = 'Text';
    result.exportName = result.exportName.substring(0, result.exportName.length - textSuffix.length);
  }
  
  // 3. Check 9-slice @9#w,h_l,r,t,b
  // 必须是6个数字，格式固定
  const scale9NewMatch = result.exportName.match(/@9#(\d+),(\d+)_(\d+),(\d+),(\d+),(\d+)/);
  if (scale9NewMatch) {
    // Width, Height, Left, Right, Top, Bottom
    result.targetSize = {
      width: parseInt(scale9NewMatch[1]),
      height: parseInt(scale9NewMatch[2])
    };
    // Unity Border order: Left, Bottom, Right, Top
    result.border = [
      parseInt(scale9NewMatch[3]), // Left
      parseInt(scale9NewMatch[6]), // Bottom
      parseInt(scale9NewMatch[4]), // Right
      parseInt(scale9NewMatch[5])  // Top
    ];
    result.exportName = result.exportName.replace(scale9NewMatch[0], '');
  }
  
  // 旧格式 @9#t_r_b_l 已移除支持
  // 如果需要兼容，请使用新格式 @9#w,h_t,r,b,l
  
  // 4. 不再强制移除 @ 后面的内容，除非它匹配已知的后缀
  // 用户反馈这导致了资源丢失。
  // 仅替换非法字符
  
  // Clean up export name - remove ONLY invalid characters for file system
  // Windows invalid: < > : " / \ | ? *
  // Unix invalid: / (already covered)
  // We should also handle control characters
  result.exportName = result.exportName
    .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid filename chars
    .replace(/[\x00-\x1f]/g, '')    // Remove control chars
    .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
    .trim();                        // Trim leading/trailing spaces

  return result;
}
