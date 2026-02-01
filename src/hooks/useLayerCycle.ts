import { useCallback } from 'react';
import { useSelectionStore } from '../stores';

interface UseLayerCycleReturn {
  cycleToNextLayer: () => void;
  cycleToPrevLayer: () => void;
  currentIndex: number;
  totalLayers: number;
}

/**
 * 图层循环选择 Hook
 * 支持 Ctrl+点击循环选择重叠的图层
 */
export function useLayerCycle(): UseLayerCycleReturn {
  const {
    overlappingLayers,
    overlappingIndex,
    cycleOverlapping,
    selectLayer,
  } = useSelectionStore();

  // 循环到下一个图层
  const cycleToNextLayer = useCallback(() => {
    if (overlappingLayers.length <= 1) return;
    cycleOverlapping();
  }, [overlappingLayers.length, cycleOverlapping]);

  // 循环到上一个图层
  const cycleToPrevLayer = useCallback(() => {
    if (overlappingLayers.length <= 1) return;

    const prevIndex =
      (overlappingIndex - 1 + overlappingLayers.length) % overlappingLayers.length;
    const prevLayer = overlappingLayers[prevIndex];

    selectLayer(prevLayer);
  }, [overlappingLayers, overlappingIndex, selectLayer]);

  return {
    cycleToNextLayer,
    cycleToPrevLayer,
    currentIndex: overlappingIndex,
    totalLayers: overlappingLayers.length,
  };
}
