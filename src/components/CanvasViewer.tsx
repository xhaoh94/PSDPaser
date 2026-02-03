import React, { useRef, useEffect, useCallback, useState } from 'react';
import { usePsdStore, useSelectionStore, useUiStore } from '../stores';
import { useCanvasTransform } from '../hooks/useCanvasTransform';
import { useLayerCycle } from '../hooks/useLayerCycle';
import { LayerContextMenu } from './LayerContextMenu';
import type { PsdLayer } from '../types/psd';

// 混合模式映射表
const blendModeMap: Record<string, GlobalCompositeOperation> = {
  'normal': 'source-over',
  'multiply': 'multiply',
  'screen': 'screen',
  'overlay': 'overlay',
  'darken': 'darken',
  'lighten': 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  'difference': 'difference',
  'exclusion': 'exclusion',
  'hue': 'hue',
  'saturation': 'saturation',
  'color': 'color',
  'luminosity': 'luminosity',
};

interface CanvasViewerProps {
  onLayerClick?: (layer: PsdLayer | null, layers: PsdLayer[]) => void;
}

/**
 * Canvas 渲染组件（高性能版本）
 * - 使用离屏 canvas 缓存图层内容
 * - 选中时只重绘选中框，不重绘图层
 */
export const CanvasViewer: React.FC<CanvasViewerProps> = ({ onLayerClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // 离屏 canvas 缓存图层内容
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenValidRef = useRef(false);
  // 临时 canvas 用于遮罩处理
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const { document } = usePsdStore();
  const { selectedLayer, selectLayer, setOverlappingLayers, overlappingLayers, overlappingIndex } = useSelectionStore();
  const { scale, offset, setCursorPosition, centerCanvas } = useUiStore();
  const {
    handleWheel,
    handleMouseDown,
    handleMouseMove: handlePanMouseMove,
    handleMouseUp,
    isDragging,
  } = useCanvasTransform();

  // 包装鼠标移动事件，同时处理平移和坐标更新
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handlePanMouseMove(e);

    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left - offset.x) / scale);
      const y = Math.round((e.clientY - rect.top - offset.y) / scale);
      setCursorPosition({ x, y });
    }
  }, [handlePanMouseMove, offset, scale, setCursorPosition]);

  const { cycleToNextLayer } = useLayerCycle();

  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuLayers, setContextMenuLayers] = useState<PsdLayer[]>([]);

  // 绘制棋盘格背景（透明指示）
  const drawCheckerboard = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const size = 10;
      const lightColor = '#ffffff';
      const darkColor = '#cccccc';

      for (let y = 0; y < height; y += size) {
        for (let x = 0; x < width; x += size) {
          const isLight = ((x / size) + (y / size)) % 2 === 0;
          ctx.fillStyle = isLight ? lightColor : darkColor;
          ctx.fillRect(x, y, size, size);
        }
      }
    },
    []
  );

  // 获取或创建临时 canvas
  const getTempCanvas = useCallback((width: number, height: number) => {
    if (!tempCanvasRef.current) {
      tempCanvasRef.current = window.document.createElement('canvas');
    }
    const temp = tempCanvasRef.current;
    if (temp.width !== width || temp.height !== height) {
      temp.width = width;
      temp.height = height;
    }
    return temp;
  }, []);

  // 描边 canvas 缓存
  const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const getStrokeCanvas = useCallback((width: number, height: number) => {
    if (!strokeCanvasRef.current) {
      strokeCanvasRef.current = window.document.createElement('canvas');
    }
    const canvas = strokeCanvasRef.current;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return canvas;
  }, []);

  // 第二个缓存 canvas（用于内部描边计算）
  const strokeCanvas2Ref = useRef<HTMLCanvasElement | null>(null);
  const getStrokeCanvas2 = useCallback((width: number, height: number) => {
    if (!strokeCanvas2Ref.current) {
      strokeCanvas2Ref.current = window.document.createElement('canvas');
    }
    const canvas = strokeCanvas2Ref.current;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return canvas;
  }, []);

  // 遮罩处理用的缓存 canvas
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const getMaskCanvas = useCallback((width: number, height: number) => {
    if (!maskCanvasRef.current) {
      maskCanvasRef.current = window.document.createElement('canvas');
    }
    const canvas = maskCanvasRef.current;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return canvas;
  }, []);

  /**
   * 精确描边渲染
   * 使用膨胀/收缩算法来创建描边效果，支持 outside/inside/center 三种位置
   */
  const renderStroke = useCallback((
    ctx: CanvasRenderingContext2D,
    sourceCanvas: HTMLCanvasElement,
    strokeColor: string,
    strokeWidth: number,
    position: 'inside' | 'center' | 'outside',
    destX: number,
    destY: number,
    padding: number
  ) => {
    if (strokeWidth <= 0) return;

    const srcWidth = sourceCanvas.width;
    const srcHeight = sourceCanvas.height;

    // 创建描边用的临时 canvas
    const expandedWidth = srcWidth + padding * 2;
    const expandedHeight = srcHeight + padding * 2;
    const strokeCanvas = getStrokeCanvas(expandedWidth, expandedHeight);
    const strokeCtx = strokeCanvas.getContext('2d');
    if (!strokeCtx) return;

    strokeCtx.clearRect(0, 0, expandedWidth, expandedHeight);

    // 计算方向数量（根据描边宽度动态调整）
    const directions = Math.max(16, Math.min(48, Math.round(strokeWidth * 6)));

    // 根据描边位置计算实际宽度
    let outerWidth = 0;
    let innerWidth = 0;

    switch (position) {
      case 'outside':
        outerWidth = strokeWidth;
        innerWidth = 0;
        break;
      case 'inside':
        outerWidth = 0;
        innerWidth = strokeWidth;
        break;
      case 'center':
        outerWidth = strokeWidth / 2;
        innerWidth = strokeWidth / 2;
        break;
    }

    // 1. 绘制外部描边（膨胀）
    if (outerWidth > 0) {
      // 使用多方向偏移叠加实现膨胀效果
      for (let i = 0; i < directions; i++) {
        const angle = (i / directions) * Math.PI * 2;
        for (let d = 1; d <= Math.ceil(outerWidth); d++) {
          // 使用平滑过渡
          const ratio = Math.min(1, d / outerWidth);
          const offsetX = Math.cos(angle) * d * ratio;
          const offsetY = Math.sin(angle) * d * ratio;
          strokeCtx.drawImage(
            sourceCanvas,
            padding + offsetX,
            padding + offsetY
          );
        }
      }
    }

    // 也绘制原始图像作为基础（对于 center 模式需要）
    if (outerWidth > 0 || innerWidth > 0) {
      strokeCtx.drawImage(sourceCanvas, padding, padding);
    }

    // 将膨胀后的图像填充为描边颜色
    strokeCtx.globalCompositeOperation = 'source-in';
    strokeCtx.fillStyle = strokeColor;
    strokeCtx.fillRect(0, 0, expandedWidth, expandedHeight);
    strokeCtx.globalCompositeOperation = 'source-over';

    // 2. 处理内部描边或挖空中心
    if (innerWidth > 0) {
      // 需要保留边缘区域，挖掉内部区域
      const innerCanvas = getStrokeCanvas2(srcWidth, srcHeight);
      const innerCtx = innerCanvas.getContext('2d');
      if (innerCtx) {
        // 绘制原始图像
        innerCtx.clearRect(0, 0, srcWidth, srcHeight);
        innerCtx.drawImage(sourceCanvas, 0, 0);

        // 使用 destination-out 来收缩边界
        innerCtx.globalCompositeOperation = 'destination-out';

        // 从边缘向内擦除
        for (let i = 0; i < directions; i++) {
          const angle = (i / directions) * Math.PI * 2;
          for (let d = 1; d <= Math.ceil(innerWidth); d++) {
            const offsetX = Math.cos(angle) * d;
            const offsetY = Math.sin(angle) * d;
            innerCtx.drawImage(
              sourceCanvas,
              -offsetX,
              -offsetY
            );
          }
        }
        innerCtx.globalCompositeOperation = 'source-over';

        // 从描边中挖掉收缩后的区域
        strokeCtx.globalCompositeOperation = 'destination-out';
        strokeCtx.drawImage(innerCanvas, padding, padding);
        strokeCtx.globalCompositeOperation = 'source-over';
      }
    } else {
      // outside 模式：挖掉原始图像区域
      strokeCtx.globalCompositeOperation = 'destination-out';
      strokeCtx.drawImage(sourceCanvas, padding, padding);
      strokeCtx.globalCompositeOperation = 'source-over';
    }

    // 绘制描边到目标 context
    ctx.drawImage(strokeCanvas, destX - padding, destY - padding);
  }, [getStrokeCanvas, getStrokeCanvas2]);

  // 渲染单个图层（支持遮罩、混合模式、效果）
  const renderLayer = useCallback(
    (ctx: CanvasRenderingContext2D, layer: PsdLayer) => {
      if (!layer.visible || !layer.canvas) return;

      const { left, top, right, bottom } = layer.bounds;
      const width = right - left;
      const height = bottom - top;

      if (width <= 0 || height <= 0) return;

      // 获取混合模式
      const blendOp = blendModeMap[layer.blendMode || 'normal'] || 'source-over';
      const opacity = layer.opacity;

      // 检查是否需要遮罩处理
      const hasMask = layer.mask && layer.mask.canvas && !layer.mask.disabled;

      // 检查是否有阴影效果
      const hasDropShadow = layer.effects?.dropShadow && layer.effects.dropShadow.length > 0;

      // 描边效果
      const stroke = layer.effects?.stroke?.[0];
      const hasStroke = stroke && stroke.width > 0;

      // 简单绘制：无遮罩，无复杂效果
      if (!hasMask && !hasDropShadow && !hasStroke) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.globalCompositeOperation = blendOp;
        ctx.drawImage(layer.canvas, left, top);
        ctx.restore();
        return;
      }

      // 复杂绘制：需要临时 canvas
      // 描边会扩展边界，需要更大的临时 canvas
      const strokeWidth = hasStroke ? stroke!.width : 0;
      const shadowBlur = hasDropShadow ? layer.effects!.dropShadow![0].blur : 0;
      const shadowDistance = hasDropShadow ? layer.effects!.dropShadow![0].distance : 0;
      // 计算所需的 padding（考虑描边和阴影）
      const padding = Math.max(strokeWidth * 2, shadowBlur + shadowDistance);
      const tempWidth = width + padding * 2;
      const tempHeight = height + padding * 2;

      const tempCanvas = getTempCanvas(tempWidth, tempHeight);
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // 清空临时 canvas
      tempCtx.clearRect(0, 0, tempWidth, tempHeight);

      // 获取可能被遮罩处理后的图层内容
      let contentCanvas: HTMLCanvasElement = layer.canvas;

      // 如果有遮罩，先在单独的 canvas 上处理遮罩
      if (hasMask && layer.mask!.canvas) {
        const maskTempCanvas = getMaskCanvas(width, height);
        const maskTempCtx = maskTempCanvas.getContext('2d');
        if (maskTempCtx) {
          maskTempCtx.clearRect(0, 0, width, height);
          // 绘制原始内容
          maskTempCtx.drawImage(layer.canvas, 0, 0);
          // 应用遮罩
          maskTempCtx.globalCompositeOperation = 'destination-in';
          const maskOffsetX = layer.mask!.bounds.left - left;
          const maskOffsetY = layer.mask!.bounds.top - top;
          maskTempCtx.drawImage(layer.mask!.canvas, maskOffsetX, maskOffsetY);
          maskTempCtx.globalCompositeOperation = 'source-over';
          contentCanvas = maskTempCanvas;
        }
      }

      // 1. 应用描边效果（描边不受遮罩影响，使用原始图层形状）
      if (hasStroke) {
        renderStroke(
          tempCtx,
          layer.canvas,  // 使用原始图层，不是遮罩后的
          stroke!.color,
          stroke!.width,
          stroke!.position,
          padding,
          padding,
          padding
        );
      }

      // 2. 应用阴影效果
      if (hasDropShadow) {
        const shadow = layer.effects!.dropShadow![0];
        const angleRad = (shadow.angle * Math.PI) / 180;

        // 将 HEX 颜色转换为带 alpha 的 rgba
        let shadowColor = shadow.color;
        if (shadow.opacity !== undefined && shadow.opacity < 1) {
          // 解析 HEX 颜色并添加 alpha
          const hex = shadow.color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          shadowColor = `rgba(${r}, ${g}, ${b}, ${shadow.opacity})`;
        }

        tempCtx.save();
        tempCtx.shadowColor = shadowColor;
        tempCtx.shadowBlur = shadow.blur;
        tempCtx.shadowOffsetX = Math.cos(angleRad) * shadow.distance;
        tempCtx.shadowOffsetY = Math.sin(angleRad) * shadow.distance;
        // 绘制内容（带阴影）
        tempCtx.drawImage(contentCanvas, padding, padding);
        tempCtx.restore();
      } else {
        // 3. 绘制图层内容（无阴影情况）
        tempCtx.globalCompositeOperation = 'source-over';
        tempCtx.drawImage(contentCanvas, padding, padding);
      }

      // 4. 绘制到主 canvas
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendOp;
      ctx.drawImage(tempCanvas, left - padding, top - padding);
      ctx.restore();
    },
    [getTempCanvas, getMaskCanvas, renderStroke]
  );

  // 递归绘制图层
  const drawLayers = useCallback(
    (ctx: CanvasRenderingContext2D, layers: PsdLayer[]) => {
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (!layer.visible) continue;

        if (layer.type === 'group' && layer.children) {
          drawLayers(ctx, layer.children);
          continue;
        }

        renderLayer(ctx, layer);
      }
    },
    [renderLayer]
  );

  // 创建/更新离屏 canvas 缓存
  const updateOffscreenCanvas = useCallback(() => {
    if (!document) return;

    // 创建离屏 canvas
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = window.document.createElement('canvas');
    }

    const offscreen = offscreenCanvasRef.current;
    offscreen.width = document.width;
    offscreen.height = document.height;

    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // 清空
    ctx.clearRect(0, 0, offscreen.width, offscreen.height);

    // 优先使用合成图像（Photoshop 渲染的完整预览，包含所有效果）
    if (document.canvas) {
      // 合成图像已包含正确的描边、阴影等效果
      ctx.drawImage(document.canvas, 0, 0);
      console.log('[CanvasViewer] 使用合成图像渲染');
    } else {
      // 回退：使用棋盘格背景 + 逐层渲染
      drawCheckerboard(ctx, document.width, document.height);
      drawLayers(ctx, document.layers);
    }

    // 绘制边框
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, document.width, document.height);

    offscreenValidRef.current = true;
    console.log('[CanvasViewer] 离屏缓存已更新');
  }, [document, drawCheckerboard, drawLayers]);

  // 文档变化时更新离屏缓存
  useEffect(() => {
    if (document) {
      offscreenValidRef.current = false;
      // 使用 requestIdleCallback 延迟更新，避免阻塞
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => updateOffscreenCanvas(), { timeout: 100 });
      } else {
        setTimeout(updateOffscreenCanvas, 0);
      }
    }
  }, [document, updateOffscreenCanvas]);

  // 绘制选中高亮（双色边框：白色底边 + 蓝色主边）
  const drawSelection = useCallback(
    (ctx: CanvasRenderingContext2D, layer: PsdLayer) => {
      const { left, top, right, bottom } = layer.bounds;
      const width = right - left;
      const height = bottom - top;

      ctx.save();

      // 外层：白色实线边框
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4 / scale;
      ctx.setLineDash([]);
      ctx.strokeRect(left, top, width, height);

      // 内层：蓝色虚线边框
      ctx.strokeStyle = '#1890ff';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.strokeRect(left, top, width, height);

      ctx.restore();
    },
    [scale]
  );

  // 快速绘制函数（使用缓存）
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !document) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 canvas 尺寸为容器大小
    const rect = container.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 应用变换
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // 使用离屏缓存绘制（如果可用）
    if (offscreenValidRef.current && offscreenCanvasRef.current) {
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
    } else if (document.canvas) {
      // 优先使用合成图像（包含完整效果）
      ctx.drawImage(document.canvas, 0, 0);
      // 绘制边框
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1 / scale;
      ctx.strokeRect(0, 0, document.width, document.height);
    } else {
      // 回退：棋盘格背景 + 逐层渲染
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, document.width, document.height);
      ctx.clip();
      drawCheckerboard(ctx, document.width, document.height);
      ctx.restore();

      drawLayers(ctx, document.layers);

      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1 / scale;
      ctx.strokeRect(0, 0, document.width, document.height);
    }

    // 绘制选中高亮（这是唯一需要每次重绘的部分）
    if (selectedLayer) {
      drawSelection(ctx, selectedLayer);
    }

    ctx.restore();
  }, [document, offset, scale, selectedLayer, drawCheckerboard, drawLayers, drawSelection]);

  // 使用 requestAnimationFrame 优化绘制
  const rafIdRef = useRef<number>(0);

  useEffect(() => {
    // 取消之前的 RAF
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // 使用 RAF 绘制
    rafIdRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [draw]);

  // 文档加载时居中显示
  useEffect(() => {
    if (document && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      centerCanvas(document.width, document.height, rect.width, rect.height);
    }
  }, [document, centerCanvas]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(draw);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // 绑定滚轮事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // 处理点击事件
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!document || !canvasRef.current || isDragging) return;
      if (e.button !== 0) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const psdX = (mouseX - offset.x) / scale;
      const psdY = (mouseY - offset.y) / scale;

      const hitLayers = findLayersAtPoint(document.layers, psdX, psdY);

      if (hitLayers.length > 1) {
        const isSamePosition =
          overlappingLayers.length === hitLayers.length &&
          overlappingLayers.every((layer, i) => layer.id === hitLayers[i]?.id);

        if (isSamePosition) {
          cycleToNextLayer();
        } else {
          setOverlappingLayers(hitLayers);
          selectLayer(hitLayers[0]);
        }
      } else {
        setOverlappingLayers(hitLayers);
        const topLayer = hitLayers[0] || null;
        selectLayer(topLayer);
      }

      if (onLayerClick) {
        onLayerClick(selectedLayer, hitLayers);
      }
    },
    [document, offset, scale, onLayerClick, isDragging, selectLayer, setOverlappingLayers, cycleToNextLayer, overlappingLayers, selectedLayer]
  );

  // 处理右键菜单
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!document || !canvasRef.current) return;
      e.preventDefault();

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const psdX = (mouseX - offset.x) / scale;
      const psdY = (mouseY - offset.y) / scale;

      const hitLayers = findLayersAtPoint(document.layers, psdX, psdY);

      setOverlappingLayers(hitLayers);
      setContextMenuLayers(hitLayers);
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setContextMenuVisible(true);
    },
    [document, offset, scale, setOverlappingLayers]
  );

  // 处理右键菜单选择
  const handleContextMenuSelect = useCallback(
    (layer: PsdLayer) => {
      selectLayer(layer);
      if (onLayerClick) {
        onLayerClick(layer, contextMenuLayers);
      }
    },
    [selectLayer, onLayerClick, contextMenuLayers]
  );

  // 递归查找点击位置的所有图层
  const findLayersAtPoint = (
    layers: PsdLayer[],
    x: number,
    y: number
  ): PsdLayer[] => {
    const result: PsdLayer[] = [];

    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible) continue;

      if (layer.type === 'group' && layer.children) {
        result.push(...findLayersAtPoint(layer.children, x, y));
        continue;
      }

      const { left, top, right, bottom } = layer.bounds;
      if (x >= left && x <= right && y >= top && y <= bottom) {
        result.push(layer);
      }
    }

    return result;
  };

  return (
    <LayerContextMenu
      layers={contextMenuLayers}
      onSelect={handleContextMenuSelect}
      visible={contextMenuVisible}
      position={contextMenuPosition}
      onVisibleChange={setContextMenuVisible}
    >
      <div
        ref={containerRef}
        className={`w-full h-full overflow-hidden relative ${isDragging ? 'cursor-grabbing' : 'cursor-default'
          }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <canvas
          ref={canvasRef}
          className="block"
        />
        {/* 点击切换图层提示 */}
        {overlappingLayers.length > 1 && (
          <div className="absolute bottom-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-xs">
            点击切换图层 ({overlappingIndex + 1}/{overlappingLayers.length})
          </div>
        )}
      </div>
    </LayerContextMenu>
  );
};
