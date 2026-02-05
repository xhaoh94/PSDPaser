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

  // 九宫格 @9#t_r_b_l (top, right, bottom, left)
  // 这个规则通常比较固定，可以不提取，或者作为特殊规则
  const scale9Match = layerName.match(/@9#(\d+)_(\d+)_(\d+)_(\d+)/);
  if (scale9Match) {
    result.scale9Grid = [
      parseInt(scale9Match[1]),
      parseInt(scale9Match[2]),
      parseInt(scale9Match[3]),
      parseInt(scale9Match[4])
    ];
    layerName = layerName.replace(scale9Match[0], '');
  }

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
    }
  } else {
    // 普通图层，使用清理后的名称
    result.exportName = layerName.trim();
    result.nodeName = result.exportName;
  }

  return result;
}
