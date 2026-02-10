import type { FguiResource } from './types';

/**
 * 生成 FGUI XML 的工具函数
 */

// 简单的 XML 转义
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
    return c;
  });
}

/**
 * 解析 package.xml 获取现有资源
 */
export function parsePackageXml(xml: string): { id: string; resources: FguiResource[] } {
  const pkgIdMatch = xml.match(/packageDescription\s+[^>]*id="([^"]+)"/);
  const pkgId = pkgIdMatch ? pkgIdMatch[1] : '';
  
  const resources: FguiResource[] = [];
  // 匹配资源标签
  const tagRegex = /<(image|component|swf|movieclip|font|sound|atlas)\s+([^>]+?)\/?>/g;
  let match;
  
  while ((match = tagRegex.exec(xml)) !== null) {
    const type = match[1];
    const attrsStr = match[2];
    
    const idMatch = attrsStr.match(/\bid="([^"]+)"/);
    const nameMatch = attrsStr.match(/\bname="([^"]+)"/);
    const pathMatch = attrsStr.match(/\bpath="([^"]+)"/);
    const exportedMatch = attrsStr.match(/\bexported="([^"]+)"/);
    const sizeMatch = attrsStr.match(/\bsize="(\d+),(\d+)"/);
    
    if (idMatch && nameMatch) {
      resources.push({
        id: idMatch[1],
        name: nameMatch[1],
        type,
        path: pathMatch ? pathMatch[1] : undefined,
        exported: exportedMatch ? exportedMatch[1] === 'true' : undefined,
        width: sizeMatch ? parseInt(sizeMatch[1]) : 0,
        height: sizeMatch ? parseInt(sizeMatch[2]) : 0
      });
    }
  }
  
  return { id: pkgId, resources };
}

interface XmlNode {
  tag: string;
  attrs?: Record<string, string | number | boolean | undefined>;
  children?: (XmlNode | string)[];
}

/**
 * 递归生成 XML 字符串
 */
export function buildXml(node: XmlNode, indentLevel = 0): string {
  const indent = '  '.repeat(indentLevel);
  const { tag, attrs, children } = node;
  
  let attrsStr = '';
  if (attrs) {
    attrsStr = Object.entries(attrs)
      .filter(([_, v]) => v !== undefined && v !== null)
      .map(([k, v]) => ` ${k}="${escapeXml(String(v))}"`)
      .join('');
  }

  if (!children || children.length === 0) {
    return `${indent}<${tag}${attrsStr} />`;
  }

  const childrenStr = children.map(child => {
    if (typeof child === 'string') {
      return `${indent}  ${escapeXml(child)}`;
    }
    return buildXml(child, indentLevel + 1);
  }).join('\n');

  return `${indent}<${tag}${attrsStr}>\n${childrenStr}\n${indent}</${tag}>`;
}

/**
 * 生成 package.xml
 */
export function generatePackageXml(
  packageId: string, 
  resources: FguiResource[]
): string {
  const root: XmlNode = {
    tag: 'packageDescription',
    attrs: { id: packageId },
    children: [
      {
        tag: 'resources',
        children: resources.map(res => {
          // 处理九宫格数据转换 (TRBL -> XYWH)
          let scale9gridStr: string | undefined;
          if (res.scale9grid && res.width && res.height) {
             const [top, right, bottom, left] = res.scale9grid;
             const x = left;
             const y = top;
             const w = Math.max(0, res.width - left - right);
             const h = Math.max(0, res.height - top - bottom);
             scale9gridStr = `${x},${y},${w},${h}`;
             console.log(`[XmlGenerator] 9-slice for ${res.name}: Size=${res.width}x${res.height}, TRBL=[${top},${right},${bottom},${left}] -> Rect=${scale9gridStr}`);
          }

          return {
            tag: res.type, // component, image, etc.
            attrs: {
              id: res.id,
              name: res.name,
              path: res.path,
              exported: res.exported ? 'true' : undefined,
              scale: res.scale9grid ? '9grid' : undefined,
              scale9grid: scale9gridStr // 使用转换后的 XYWH 格式
            }
          };
        })
      }
    ]
  };
  
  return '<?xml version="1.0" encoding="utf-8"?>\n' + buildXml(root);
}

/**
 * 生成组件 XML (基础结构)
 */
export function generateComponentXml(
  width: number, 
  height: number, 
  displayList: XmlNode[], 
  extention?: string
): string {
  const root: XmlNode = {
    tag: 'component',
    attrs: { size: `${width},${height}`, extention },
    children: [
      {
        tag: 'displayList',
        children: displayList
      }
    ]
  };
  
  return '<?xml version="1.0" encoding="utf-8"?>\n' + buildXml(root);
}
