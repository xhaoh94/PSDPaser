import type { FguiNodeInfo, FguiPackageInfo } from './types';
import type { NamingRules } from '../../stores/configStore';

const DEFAULT_RULES: NamingRules = {
  prefixes: {
    common: 'Common@'
  },
  suffixes: {
    noExport: '@NoExport',
    img: '@img',
    input: '@txt',
    rich: '@rich'
  },
  componentPrefix: {
    'Com': { type: 'Component', prefix: 'com' },
    'Btn': { type: 'Button', prefix: 'btn' },
    'ChkBtn': { type: 'Button', prefix: 'chk' },
    'Bar': { type: 'ProgressBar', prefix: 'bar' },
    'Cbo': { type: 'ComboBox', prefix: 'cbo' }
  }
};

/**
 * 下划线/任意分隔符转小驼峰
 * Com$Start_Btn -> comStartBtn
 */
export function toLowerCamelCase(str: string): string {
  return str
    .replace(/^[_$\s]+/, '')
    .replace(/[_$\s]+(.)/g, (_, c) => c.toUpperCase());
}

/**
 * 首字母大写
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * 解析 PSD 文件名
 * Format: PackageName@Description.psd
 */
export function parsePsdFileName(fileName: string): FguiPackageInfo | null {
  // 移除扩展名
  const name = fileName.replace(/\.psd$/i, '');
  const match = name.match(/^([^@]+)(?:@(.+))?$/);
  
  if (!match) return null;
  
  return {
    name: match[1],
    desc: match[2]
  };
}

/**
 * 解析图层名称
 */
export function parseLayerName(layerName: string, customRules?: NamingRules): FguiNodeInfo {
  const rules = customRules || DEFAULT_RULES;
  const result: FguiNodeInfo = {
    originalName: layerName,
    exportName: layerName,
    type: 'Image', // 默认为图片
    isCommon: false,
    isExported: false,
  };

  // 1. 检查 Common@ 前缀
  if (layerName.startsWith(rules.prefixes.common)) {
    result.isCommon = true;
    layerName = layerName.substring(rules.prefixes.common.length);
  }

  // 2. 检查特殊后缀
  // @NoExport
  if (layerName.endsWith(rules.suffixes.noExport)) {
    result.noExport = true;
    layerName = layerName.substring(0, layerName.length - rules.suffixes.noExport.length);
  }

  // @img (Loader)
  if (layerName.endsWith(rules.suffixes.img)) {
    result.isImg = true;
    result.type = 'Loader';
    layerName = layerName.substring(0, layerName.length - rules.suffixes.img.length);
  }
  
  // @txt (InputText)
  if (layerName.endsWith(rules.suffixes.input)) {
    result.type = 'InputText';
    layerName = layerName.substring(0, layerName.length - rules.suffixes.input.length);
  }
  
  // @rich (RichText)
  if (layerName.endsWith(rules.suffixes.rich)) {
    result.type = 'RichText';
    layerName = layerName.substring(0, layerName.length - rules.suffixes.rich.length);
  }

  // 九宫格 @9#width,height_left,right,top,bottom
  // 必须是6个数字，格式固定
  const scale9NewMatch = layerName.match(/@9#(\d+),(\d+)_(\d+),(\d+),(\d+),(\d+)/);
  if (scale9NewMatch) {
    // Width, Height, Left, Right, Top, Bottom
    result.targetSize = {
      width: parseInt(scale9NewMatch[1]),
      height: parseInt(scale9NewMatch[2])
    };
    // FGUI scale9Grid order: Top, Right, Bottom, Left
    result.scale9Grid = [
      parseInt(scale9NewMatch[5]), // Top
      parseInt(scale9NewMatch[4]), // Right
      parseInt(scale9NewMatch[6]), // Bottom
      parseInt(scale9NewMatch[3])  // Left
    ];
    console.log(`[NameParser] Parsed 9-slice for ${result.originalName}:`, result.scale9Grid, result.targetSize);
    layerName = layerName.replace(scale9NewMatch[0], '');
  }
  
  // 旧格式 @9#t_r_b_l 已移除支持
  // 如果需要兼容，请使用新格式 @9#w,h_t,r,b,l

  // 3. 检查组件类型前缀
  // 动态构建正则
  const prefixes = Object.keys(rules.componentPrefix);
  const prefixRegex = new RegExp(`^(${prefixes.join('|')})\\$([\\w_\\u4e00-\\u9fa5]+)`);
  
  const componentMatch = layerName.match(prefixRegex);
  
  if (componentMatch) {
    result.isExported = true;
    const prefix = componentMatch[1];
    const rawName = componentMatch[2];
    
    const config = rules.componentPrefix[prefix];
    if (config) {
        result.type = config.type as any;
        const finalPrefix = config.prefix;
        
        const camelSuffix = capitalize(toLowerCamelCase(rawName));
        
        // exportName (文件名): PascalCase
        const filePrefix = capitalize(finalPrefix); 
        result.exportName = filePrefix + camelSuffix;
        
        // nodeName (实例名): camelCase
        result.nodeName = finalPrefix + camelSuffix;
        
        // 如果是 Common 组件，添加 Common 前缀 (大驼峰)
        if (result.isCommon) {
            result.exportName = 'Common' + result.exportName;
        }
    }
  } else {
    // 普通图层，使用清理后的名称
    result.exportName = layerName.trim();
    result.nodeName = result.exportName;
  }

  return result;
}
