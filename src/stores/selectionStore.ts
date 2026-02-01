import { create } from 'zustand';
import type { PsdLayer } from '../types/psd';

interface SelectionState {
  // 当前选中的图层 ID
  selectedLayerId: string | null;
  // 缓存选中的图层对象（避免频繁查找）
  selectedLayer: PsdLayer | null;
  // 重叠图层列表（用于透传选择）
  overlappingLayers: PsdLayer[];
  // 当前在重叠列表中的索引
  overlappingIndex: number;
  
  // Actions
  selectLayer: (layer: PsdLayer | null) => void;
  setOverlappingLayers: (layers: PsdLayer[]) => void;
  cycleOverlapping: () => void; // Ctrl+点击循环
  clearSelection: () => void;
}

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedLayerId: null,
  selectedLayer: null,
  overlappingLayers: [],
  overlappingIndex: 0,
  
  selectLayer: (layer) => set({
    selectedLayerId: layer?.id ?? null,
    selectedLayer: layer,
    overlappingIndex: 0, // 重置循环索引
  }),
  
  setOverlappingLayers: (layers) => set({
    overlappingLayers: layers,
    overlappingIndex: 0,
  }),
  
  cycleOverlapping: () => {
    const { overlappingLayers, overlappingIndex } = get();
    if (overlappingLayers.length === 0) return;
    
    const nextIndex = (overlappingIndex + 1) % overlappingLayers.length;
    const nextLayer = overlappingLayers[nextIndex];
    
    set({
      overlappingIndex: nextIndex,
      selectedLayerId: nextLayer.id,
      selectedLayer: nextLayer,
    });
  },
  
  clearSelection: () => set({
    selectedLayerId: null,
    selectedLayer: null,
    overlappingLayers: [],
    overlappingIndex: 0,
  }),
}));
