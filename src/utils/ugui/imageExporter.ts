import { LayerRenderer } from '../fgui/renderer';
import type { PsdLayer } from '../../types/psd';
import type { SpriteInfo } from './types';

function generateGuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  // Fallback
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function generateMetaContent(guid: string, border: [number, number, number, number] = [0, 0, 0, 0]): string {
  // Simple Unity 2021+ Meta Template for Sprite
  // Note: This is a minimal template. Real Unity meta files are more complex but this often works for import.
  // Border: Left, Bottom, Right, Top
  return `fileFormatVersion: 2
guid: ${guid}
TextureImporter:
  internalIDToNameTable: []
  externalObjects: {}
  serializedVersion: 12
  textureType: 8
  mipmaps:
    mipMapMode: 0
    enableMipMap: 0
    sRGBTexture: 1
    linearTexture: 0
    fadeOut: 0
    borderMipMap: 0
    mipMapsPreserveCoverage: 0
    alphaTestReferenceValue: 0.5
    mipMapFadeDistanceStart: 1
    mipMapFadeDistanceEnd: 3
  bumpmap:
    convertToNormalMap: 0
    externalNormalMap: 0
    heightScale: 0.25
    normalMapFilter: 0
  isReadable: 0
  streamingMipmaps: 0
  streamingMipmapsPriority: 0
  vTOnly: 0
  ignoreMasterTextureLimit: 0
  sprites:
  - serializedVersion: 2
    name: ${name}
    rect:
      serializedVersion: 2
      x: 0
      y: 0
      width: 0
      height: 0
    alignment: 0
    pivot: {x: 0.5, y: 0.5}
    border: {x: ${border[0]}, y: ${border[1]}, z: ${border[2]}, w: ${border[3]}}
    outline: []
    physicsShape: []
    tessellationDetail: 0
    bones: []
    spriteID: 
    internalID: 0
    vertices: []
    indices: 
    edges: []
    weights: []
  spriteMode: 1
  spriteExt: 1
  mipmapFilter: Box
  isReadable: 1
  keepTextureRects: 0
  grayScaleToAlpha: 0
  generateCubemap: 6
  cubemapConvolution: 0
  seamlessCubemap: 0
  textureFormat: 1
  maxTextureSize: 2048
  textureSettings:
    serializedVersion: 2
    filterMode: 1
    aniso: 1
    mipBias: 0
    wrapU: 1
    wrapV: 1
    wrapW: 1
  nPOTScale: 0
  lightmap: 0
  compressionQuality: 50
  spriteBorder: {x: ${border[0]}, y: ${border[1]}, z: ${border[2]}, w: ${border[3]}}
  spriteSheet:
    serializedVersion: 2
    sprites: []
    outline: []
    physicsShape: []
    bones: []
    spriteID: 
    internalID: 0
    vertices: []
    indices: 
    edges: []
    weights: []
  spritePackingTag: 
  pSDRemoveMatte: 0
  pSDShowRemoveMatteOption: 0
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
}

function trimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let top = 0, bottom = height, left = 0, right = width;
  const threshold = 15; // 提高阈值以去除淡淡的阴影/发光

  // Find top
  top: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        top = y;
        break top;
      }
    }
  }

  // Find bottom
  bottom: for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        bottom = y + 1;
        break bottom;
      }
    }
  }

  // Find left
  left: for (let x = 0; x < width; x++) {
    for (let y = top; y < bottom; y++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        left = x;
        break left;
      }
    }
  }

  // Find right
  right: for (let x = width - 1; x >= 0; x--) {
    for (let y = top; y < bottom; y++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        right = x + 1;
        break right;
      }
    }
  }

  // If empty or full, return original
  if (top >= bottom || left >= right) return canvas;
  if (top === 0 && bottom === height && left === 0 && right === width) return canvas;

  const trimmedWidth = right - left;
  const trimmedHeight = bottom - top;
  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;
  const tctx = trimmedCanvas.getContext('2d');
  
  if (tctx) {
    tctx.drawImage(canvas, left, top, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);
    return trimmedCanvas;
  }
  
  return canvas;
}

// 还原九宫格图片 (从拉伸后的大图还原回小图)
function reduceScale9Image(canvas: HTMLCanvasElement, targetW: number, targetH: number, grid: number[]): HTMLCanvasElement {
  // grid: [left, bottom, right, top] (Unity order from nameParser)
  // Wait, nameParser for UGUI returns [Left, Bottom, Right, Top]
  // But our reduceScale9Image logic (from FGUI) expects [top, right, bottom, left]
  // Let's adapt it.
  
  // UGUI nameParser: 
  // result.border = [Left, Bottom, Right, Top]
  const [left, bottom, right, top] = grid;
  
  // 原图尺寸 (拉伸后的)
  const srcW = canvas.width;
  const srcH = canvas.height;
  
  const result = document.createElement('canvas');
  result.width = targetW;
  result.height = targetH;
  const ctx = result.getContext('2d');
  if (!ctx) return canvas;
  
  // 1. 左上角 (Top-Left)
  if (top > 0 && left > 0)
    ctx.drawImage(canvas, 0, 0, left, top, 0, 0, left, top);
    
  // 2. 右上角 (Top-Right)
  if (top > 0 && right > 0)
    ctx.drawImage(canvas, srcW - right, 0, right, top, targetW - right, 0, right, top);
    
  // 3. 左下角 (Bottom-Left)
  if (bottom > 0 && left > 0)
    ctx.drawImage(canvas, 0, srcH - bottom, left, bottom, 0, targetH - bottom, left, bottom);
    
  // 4. 右下角 (Bottom-Right)
  if (bottom > 0 && right > 0)
    ctx.drawImage(canvas, srcW - right, srcH - bottom, right, bottom, targetW - right, targetH - bottom, right, bottom);
    
  // 5. 上边 (Top Edge) - 拉伸/缩放
  if (top > 0 && (targetW - left - right) > 0) {
     ctx.drawImage(canvas, 
        left, 0, srcW - left - right, top, 
        left, 0, targetW - left - right, top
     );
  }
  
  // 6. 下边 (Bottom Edge)
  if (bottom > 0 && (targetW - left - right) > 0) {
     ctx.drawImage(canvas, 
        left, srcH - bottom, srcW - left - right, bottom, 
        left, targetH - bottom, targetW - left - right, bottom
     );
  }
  
  // 7. 左边 (Left Edge)
  if (left > 0 && (targetH - top - bottom) > 0) {
     ctx.drawImage(canvas, 
        0, top, left, srcH - top - bottom, 
        0, top, left, targetH - top - bottom
     );
  }
  
  // 8. 右边 (Right Edge)
  if (right > 0 && (targetH - top - bottom) > 0) {
     ctx.drawImage(canvas, 
        srcW - right, top, right, srcH - top - bottom, 
        targetW - right, top, right, targetH - top - bottom
     );
  }
  
  // 9. 中间 (Center)
  if ((targetW - left - right) > 0 && (targetH - top - bottom) > 0) {
     ctx.drawImage(canvas, 
        left, top, srcW - left - right, srcH - top - bottom, 
        left, top, targetW - left - right, targetH - top - bottom
     );
  }
  
  return result;
}

export async function exportImage(
  layer: PsdLayer, 
  dirHandle: FileSystemDirectoryHandle, 
  name: string,
  border: [number, number, number, number] = [0, 0, 0, 0],
  targetSize?: { width: number, height: number }
): Promise<SpriteInfo | null> {
  console.log(`[ImageExporter] Starting export for: ${name}`);
  
  try {
    const renderer = new LayerRenderer();
    
    // 如果图层没有canvas (如纯色层/形状层)，创建一个空白canvas作为基础
    // 这样 LayerRenderer 就可以在上面应用效果(如渐变叠加)
    if (!layer.canvas) {
      let width = layer.bounds.right - layer.bounds.left;
      let height = layer.bounds.bottom - layer.bounds.top;
      let shouldUseMaskBounds = false;
      
      // 如果主图层bounds无效(0x0)，尝试使用遮罩的bounds
      if (width <= 0 || height <= 0) {
        if (layer.mask && layer.mask.bounds) {
          const mBounds = layer.mask.bounds;
          const mWidth = mBounds.right - mBounds.left;
          const mHeight = mBounds.bottom - mBounds.top;
          if (mWidth > 0 && mHeight > 0) {
            console.warn(`[ImageExporter] Layer ${layer.name} has 0x0 bounds, using mask bounds: ${mWidth}x${mHeight}`);
            width = mWidth;
            height = mHeight;
            // 修正图层bounds以便后续处理
            layer.bounds = { ...mBounds };
            shouldUseMaskBounds = true;
          }
        }
      }
      
      console.warn(`[ImageExporter] Layer ${layer.name} canvas check. Bounds: ${width}x${height}`);
      
      if (width > 0 && height > 0) {
        const blankCanvas = document.createElement('canvas');
        blankCanvas.width = width;
        blankCanvas.height = height;
        const bctx = blankCanvas.getContext('2d');
        
        if (bctx) {
          // 如果是因为 0x0 bounds 而使用遮罩bounds恢复的，
          // 通常这是一个纯色填充层（用户提到是"黑色遮罩"）
          // 我们填充黑色作为底色，这样配合遮罩就能显示出来
          // 如果是普通图层丢失canvas，透明底也是安全的
          if (shouldUseMaskBounds) {
             bctx.fillStyle = '#000000'; // 默认为黑色，适应常见的"黑色遮罩"情况
             bctx.fillRect(0, 0, width, height);
          }
        }
        
        // 目前先作为透明底图，依赖 LayerRenderer 应用效果
        layer.canvas = blankCanvas;
        console.log(`[ImageExporter] Created ${shouldUseMaskBounds ? 'black' : 'blank'} canvas for ${layer.name}`);
      } else {
        console.warn(`[ImageExporter] Skipping export for ${layer.name} due to invalid bounds (0x0)`);
        return null;
      }
    }

    const canvas = await renderer.bakeLayer(layer);
    
    // Use baked canvas or original if baking returns null
    let finalCanvas = canvas || layer.canvas;
    
    if (!finalCanvas) {
      console.warn(`[ImageExporter] Skipping export for ${layer.name}: no canvas content after processing`);
      return null;
    }
    
    // Trim Transparent Pixels
    // 自动修剪周围的透明区域，解决因阴影等效果导致的多余空白
    console.log(`[ImageExporter] Trimming canvas for ${name}...`);
    finalCanvas = trimCanvas(finalCanvas);
    console.log(`[ImageExporter] Canvas ready: ${finalCanvas.width}x${finalCanvas.height}`);
    
    // 如果有 targetSize (九宫格还原)，使用该尺寸作为导出尺寸
    let exportWidth = finalCanvas.width;
    let exportHeight = finalCanvas.height;
    
    if (targetSize && border) {
       exportWidth = targetSize.width;
       exportHeight = targetSize.height;
    }
    
    // Ensure transparency: Create a new canvas with transparency support
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    
    // 关键：创建context时启用alpha通道
    const ctx = exportCanvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // 完全清除为透明（包括alpha通道）
    ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
    
    if (targetSize && border) {
       // 九宫格还原绘制
       const reduced = reduceScale9Image(finalCanvas, exportWidth, exportHeight, border);
       ctx.drawImage(reduced, 0, 0);
    } else {
       // 绘制原始内容
       ctx.drawImage(finalCanvas, 0, 0);
    }
    
    // DEBUG: 在控制台显示预览
    try {
      const previewDataUrl = exportCanvas.toDataURL('image/png');
      console.log(`[ImageExporter] Preview for ${name}:`, previewDataUrl.substring(0, 100) + '...');
      // 可以在这里打开图片预览窗口
      console.log(`%c[ImageExporter] Canvas preview for ${name}:`, 'font-size: 20px; font-weight: bold;');
      console.log('%c ', `font-size: 1px; padding: ${exportCanvas.height/2}px ${exportCanvas.width/2}px; background: url(${previewDataUrl}) no-repeat; background-size: contain;`);
    } catch (e) {
      console.warn('[ImageExporter] Failed to create preview:', e);
    }
    
    console.log(`[ImageExporter] Creating PNG blob for: ${name}.png`);
    const blob = await new Promise<Blob | null>(resolve => exportCanvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Failed to create blob');
    console.log(`[ImageExporter] Blob created: ${blob.size} bytes`);
    
    // 检查是否已存在 .meta 文件，如果存在则保留原有的 GUID
    let existingGuid: string | null = null;
    try {
      const metaFileName = `${name}.png.meta`;
      const existingMetaHandle = await dirHandle.getFileHandle(metaFileName);
      const existingMetaFile = await existingMetaHandle.getFile();
      const existingMetaContent = await existingMetaFile.text();
      const guidMatch = existingMetaContent.match(/guid:\s*([a-f0-9]{32})/i);
      if (guidMatch) {
        existingGuid = guidMatch[1];
        console.log(`[ImageExporter] Found existing GUID: ${existingGuid}`);
      }
    } catch {
      // .meta 文件不存在，这是正常的，将生成新的 GUID
      console.log(`[ImageExporter] No existing meta file found for ${name}.png`);
    }
    
    console.log(`[ImageExporter] Getting file handle for: ${name}.png`);
    const fileHandle = await dirHandle.getFileHandle(`${name}.png`, { create: true });
    console.log(`[ImageExporter] Creating writable stream...`);
    const writable = await fileHandle.createWritable();
    console.log(`[ImageExporter] Writing blob...`);
    await writable.write(blob);
    console.log(`[ImageExporter] Closing stream...`);
    await writable.close();
    console.log(`[ImageExporter] PNG written successfully`);
    
    // Write Meta
    console.log(`[ImageExporter] Creating meta file: ${name}.png.meta`);
    const guid = existingGuid || generateGuid();
    const metaContent = generateMetaContent(guid, border);
    
    console.log(`[ImageExporter] Getting meta file handle...`);
    const metaHandle = await dirHandle.getFileHandle(`${name}.png.meta`, { create: true });
    console.log(`[ImageExporter] Creating meta writable stream...`);
    const metaWritable = await metaHandle.createWritable();
    console.log(`[ImageExporter] Writing meta content...`);
    await metaWritable.write(metaContent);
    console.log(`[ImageExporter] Closing meta stream...`);
    await metaWritable.close();
    console.log(`[ImageExporter] Meta written successfully`);
    
    return {
      name,
      guid,
      fileID: '21300000',
      border,
      handle: fileHandle,
      metaHandle
    };
  } catch (err) {
    console.error(`[ImageExporter] Export failed for ${name}:`, err);
    console.error(`[ImageExporter] Directory handle name: ${dirHandle.name}`);
    console.error(`[ImageExporter] Full error object:`, JSON.stringify(err, Object.getOwnPropertyNames(err)));
    throw err;
  }
}
