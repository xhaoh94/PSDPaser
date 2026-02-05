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
    
    if (idMatch && nameMatch) {
      resources.push({
        id: idMatch[1],
        name: nameMatch[1],
        type,
        path: pathMatch ? pathMatch[1] : undefined,
        exported: exportedMatch ? exportedMatch[1] === 'true' : undefined
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
  resources: { id: string; name: string; type: string; path?: string; exported?: boolean }[]
): string {
  const root: XmlNode = {
    tag: 'packageDescription',
    attrs: { id: packageId },
    children: [
      {
        tag: 'resources',
        children: resources.map(res => ({
          tag: res.type, // component, image, etc.
          attrs: {
            id: res.id,
            name: res.name,
            path: res.path,
            exported: res.exported ? 'true' : undefined
          }
        }))
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
