import React, { useRef, useEffect, useCallback } from 'react';
import { usePsdStore, useSelectionStore, useUiStore } from '../stores';
import { useCanvasTransform } from '../hooks/useCanvasTransform';
import type { PsdLayer } from '../types/psd';

interface CanvasViewerProps {
  onLayerClick?: (layer: PsdLayer | null, layers: PsdLayer[]) => void;
}

/**
 * Canvas 渲染组件
 * 渲染 PSD 图层，支持缩放、平移、选中高亮
 */
export const CanvasViewer: React.FC<CanvasViewerProps> = ({ onLayerClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { document } = usePsdStore();
  const { selectedLayer } = useSelectionStore();
  const { scale, offset } = useUiStore();
  const {
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isDragging,
  } = useCanvasTransform();

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

  // 递归绘制图层
  const drawLayers = useCallback(
    (ctx: CanvasRenderingContext2D, layers: PsdLayer[]) => {
      // 从后往前绘制（底层先绘制）
      for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];

        // 跳过隐藏图层
        if (!layer.visible) continue;

        // 如果是组，递归绘制子图层
        if (layer.type === 'group' && layer.children) {
          drawLayers(ctx, layer.children);
          continue;
        }

        // 绘制图层
        if (layer.canvas) {
          ctx.save();
          ctx.globalAlpha = layer.opacity;
          ctx.drawImage(
            layer.canvas,
            layer.bounds.left,
            layer.bounds.top
          );
          ctx.restore();
        }
      }
    },
    []
  );

  // 绘制选中高亮
  const drawSelection = useCallback(
    (ctx: CanvasRenderingContext2D, layer: PsdLayer) => {
      const { left, top, right, bottom } = layer.bounds;
      const width = right - left;
      const height = bottom - top;

      ctx.save();
      ctx.strokeStyle = '#1890ff';
      ctx.lineWidth = 2 / scale; // 保持线宽不受缩放影响
      ctx.setLineDash([5 / scale, 5 / scale]);
      ctx.strokeRect(left, top, width, height);
      ctx.restore();
    },
    [scale]
  );

  // 主绘制函数
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !document) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 canvas 尺寸为容器大小
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 应用变换
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // 绘制棋盘格背景
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, document.width, document.height);
    ctx.clip();
    drawCheckerboard(ctx, document.width, document.height);
    ctx.restore();

    // 绘制合成图像或图层
    if (document.canvas) {
      ctx.drawImage(document.canvas, 0, 0);
    } else {
      drawLayers(ctx, document.layers);
    }

    // 绘制画布边框
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(0, 0, document.width, document.height);

    // 绘制选中高亮
    if (selectedLayer) {
      drawSelection(ctx, selectedLayer);
    }

    ctx.restore();
  }, [document, offset, scale, selectedLayer, drawCheckerboard, drawLayers, drawSelection]);

  // 监听变化重绘
  useEffect(() => {
    draw();
  }, [draw]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => draw();
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
      if (e.button !== 0) return; // 只处理左键

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // 转换为 PSD 坐标
      const psdX = (mouseX - offset.x) / scale;
      const psdY = (mouseY - offset.y) / scale;

      // 查找点击的图层
      const hitLayers = findLayersAtPoint(document.layers, psdX, psdY);

      if (onLayerClick) {
        onLayerClick(hitLayers[0] || null, hitLayers);
      }
    },
    [document, offset, scale, onLayerClick, isDragging]
  );

  // 递归查找点击位置的所有图层
  const findLayersAtPoint = (
    layers: PsdLayer[],
    x: number,
    y: number
  ): PsdLayer[] => {
    const result: PsdLayer[] = [];

    // 从顶层开始遍历
    for (const layer of layers) {
      if (!layer.visible) continue;

      // 如果是组，递归检查子图层
      if (layer.type === 'group' && layer.children) {
        result.push(...findLayersAtPoint(layer.children, x, y));
        continue;
      }

      // 检查是否在边界内
      const { left, top, right, bottom } = layer.bounds;
      if (x >= left && x <= right && y >= top && y <= bottom) {
        result.push(layer);
      }
    }

    return result;
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden ${
        isDragging ? 'cursor-grabbing' : 'cursor-default'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        className="block"
      />
      {/* 缩放提示 */}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
};
