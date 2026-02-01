import { message } from 'antd';
import type { PsdLayer } from '../types/psd';

/**
 * 清理文件名，移除不合法字符
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100); // 限制长度
}

/**
 * 导出图层为 PNG
 * @param layer 要导出的图层
 * @returns Promise<boolean> 是否成功
 */
export async function exportLayerAsPng(layer: PsdLayer): Promise<boolean> {
  // 检查图层是否有 canvas
  if (!layer.canvas) {
    message.warning('该图层无法导出（无渲染内容）');
    return false;
  }

  try {
    // 使用 toBlob 导出
    return new Promise((resolve) => {
      layer.canvas!.toBlob((blob) => {
        if (!blob) {
          message.error('导出失败：无法生成图片');
          resolve(false);
          return;
        }

        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const fileName = sanitizeFileName(layer.name) || 'layer';
        
        // 创建临时 <a> 元素触发下载
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 释放 URL
        setTimeout(() => URL.revokeObjectURL(url), 100);

        message.success(`已导出: ${fileName}.png`);
        resolve(true);
      }, 'image/png');
    });
  } catch (error) {
    console.error('导出图层失败:', error);
    message.error('导出失败');
    return false;
  }
}

/**
 * 检查图层是否可导出
 */
export function canExportLayer(layer: PsdLayer | null): boolean {
  if (!layer) return false;
  return !!layer.canvas;
}
