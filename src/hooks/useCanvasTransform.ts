import { useCallback, useRef, useState } from 'react';
import { useUiStore } from '../stores';

interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface UseCanvasTransformReturn {
  transform: CanvasTransform;
  handleWheel: (e: WheelEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  resetTransform: () => void;
  isDragging: boolean;
}

/**
 * Canvas 缩放和平移 Hook
 */
export function useCanvasTransform(): UseCanvasTransformReturn {
  const { scale, offset, setScale, setOffset, resetZoom, resetOffset } = useUiStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  // 滚轮缩放
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.1, Math.min(5, scale + delta));
      
      // 以鼠标位置为中心缩放
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // 计算新的偏移以保持鼠标位置不变
      const scaleRatio = newScale / scale;
      const newOffsetX = mouseX - (mouseX - offset.x) * scaleRatio;
      const newOffsetY = mouseY - (mouseY - offset.y) * scaleRatio;
      
      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    },
    [scale, offset, setScale, setOffset]
  );

  // 开始拖拽
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 中键或空格+左键开始拖拽
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          offsetX: offset.x,
          offsetY: offset.y,
        };
      }
    },
    [offset]
  );

  // 拖拽中
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStartRef.current) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;

      setOffset({
        x: dragStartRef.current.offsetX + deltaX,
        y: dragStartRef.current.offsetY + deltaY,
      });
    },
    [isDragging, setOffset]
  );

  // 结束拖拽
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // 重置变换
  const resetTransform = useCallback(() => {
    resetZoom();
    resetOffset();
  }, [resetZoom, resetOffset]);

  return {
    transform: {
      scale,
      offsetX: offset.x,
      offsetY: offset.y,
    },
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetTransform,
    isDragging,
  };
}
