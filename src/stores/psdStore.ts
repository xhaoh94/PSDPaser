import { create } from 'zustand';
import type { PsdDocument, PsdLayer } from '../types/psd';

interface PsdState {
  // 当前加载的 PSD 文档
  document: PsdDocument | null;
  // 文件名
  fileName: string | null;
  // 加载状态
  isLoading: boolean;
  // 错误信息
  error: string | null;
  
  // Actions
  setDocument: (doc: PsdDocument, fileName: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearDocument: () => void;
  
  // 辅助方法：扁平化所有图层（包括嵌套的）
  getAllLayers: () => PsdLayer[];
  // 辅助方法：根据 ID 查找图层
  getLayerById: (id: string) => PsdLayer | undefined;
}

// 递归扁平化图层
function flattenLayers(layers: PsdLayer[]): PsdLayer[] {
  const result: PsdLayer[] = [];
  for (const layer of layers) {
    result.push(layer);
    if (layer.children) {
      result.push(...flattenLayers(layer.children));
    }
  }
  return result;
}

export const usePsdStore = create<PsdState>((set, get) => ({
  document: null,
  fileName: null,
  isLoading: false,
  error: null,
  
  setDocument: (doc, fileName) => set({ document: doc, fileName, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
  clearDocument: () => set({ document: null, fileName: null, error: null }),
  
  getAllLayers: () => {
    const doc = get().document;
    if (!doc) return [];
    return flattenLayers(doc.layers);
  },
  
  getLayerById: (id) => {
    const allLayers = get().getAllLayers();
    return allLayers.find(layer => layer.id === id);
  },
}));
