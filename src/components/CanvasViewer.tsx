import React, { useRef, useEffect, useCallback, useState } from 'react';
import { usePsdStore, useSelectionStore, useUiStore } from '../stores';
import { useCanvasTransform } from '../hooks/useCanvasTransform';
import { useLayerCycle } from '../hooks/useLayerCycle';
import { LayerContextMenu } from './LayerContextMenu';
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
    // 1. 处理平移
    handlePanMouseMove(e);

    // 2. 更新坐标
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

  // 递归绘制图层
  const drawLayers = useCallback(
    (ctx: CanvasRenderingContext2D, layers: PsdLayer[], depth = 0) => {
      // PSD 图层顺序：索引 0 = 底层（先绘制），索引 n-1 = 顶层（后绘制）
      // 所以从前往后遍历
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];

        // 跳过隐藏图层
        if (!layer.visible) continue;

        // 如果是组，递归绘制子图层
        if (layer.type === 'group' && layer.children) {
          drawLayers(ctx, layer.children, depth + 1);
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

  // 绘制选中高亮（双色边框：白色底边 + 蓝色主边）
  const drawSelection = useCallback(
    (ctx: CanvasRenderingContext2D, layer: PsdLayer) => {
      const { left, top, right, bottom } = layer.bounds;
      const width = right - left;
      const height = bottom - top;

      ctx.save();
      
      // 外层：白色实线边框（作为对比底色）
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

    // 绘制图层
    drawLayers(ctx, document.layers);

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

  // 文档加载时居中显示
  useEffect(() => {
    if (document && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      centerCanvas(document.width, document.height, rect.width, rect.height);
    }
  }, [document, centerCanvas]);

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

      // 如果有多个重叠图层，循环选择
      if (hitLayers.length > 1) {
        // 检查是否在同一位置点击（通过比较重叠图层列表）
        const isSamePosition = 
          overlappingLayers.length === hitLayers.length &&
          overlappingLayers.every((layer, i) => layer.id === hitLayers[i]?.id);
        
        if (isSamePosition) {
          // 同一位置再次点击，循环到下一个图层
          cycleToNextLayer();
        } else {
          // 新位置，保存重叠图层并选择最顶层
          setOverlappingLayers(hitLayers);
          selectLayer(hitLayers[0]);
        }
      } else {
        // 只有一个或没有图层
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

      // 转换为 PSD 坐标
      const psdX = (mouseX - offset.x) / scale;
      const psdY = (mouseY - offset.y) / scale;

      // 查找点击位置的图层
      const hitLayers = findLayersAtPoint(document.layers, psdX, psdY);

      // 保存重叠图层列表
      setOverlappingLayers(hitLayers);

      // 显示右键菜单
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

  // 递归查找点击位置的所有图层（从顶层到底层排序）
  const findLayersAtPoint = (
    layers: PsdLayer[],
    x: number,
    y: number
  ): PsdLayer[] => {
    const result: PsdLayer[] = [];

    // 从顶层开始遍历（数组末尾 = 顶层，最先检测）
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
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
    <LayerContextMenu
      layers={contextMenuLayers}
      onSelect={handleContextMenuSelect}
      visible={contextMenuVisible}
      position={contextMenuPosition}
      onVisibleChange={setContextMenuVisible}
    >
      <div
        ref={containerRef}
        className={`w-full h-full overflow-hidden relative ${
          isDragging ? 'cursor-grabbing' : 'cursor-default'
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
