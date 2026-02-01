import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '../types/psd';

interface UiState {
  // 主题
  theme: Theme;
  // Canvas 缩放级别 (1 = 100%)
  scale: number;
  // Canvas 平移偏移
  offset: { x: number; y: number };
  // 左侧面板是否折叠
  leftPanelCollapsed: boolean;
  // 右侧面板是否折叠
  rightPanelCollapsed: boolean;
  
  // Actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setOffset: (offset: { x: number; y: number }) => void;
  resetOffset: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
}

// 缩放限制
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.1;

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      scale: 1,
      offset: { x: 0, y: 0 },
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set(state => ({
        theme: state.theme === 'dark' ? 'light' : 'dark'
      })),
      
      setScale: (scale) => set({
        scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale))
      }),
      zoomIn: () => {
        const { scale } = get();
        set({ scale: Math.min(MAX_SCALE, scale + ZOOM_STEP) });
      },
      zoomOut: () => {
        const { scale } = get();
        set({ scale: Math.max(MIN_SCALE, scale - ZOOM_STEP) });
      },
      resetZoom: () => set({ scale: 1 }),
      
      setOffset: (offset) => set({ offset }),
      resetOffset: () => set({ offset: { x: 0, y: 0 } }),
      
      toggleLeftPanel: () => set(state => ({
        leftPanelCollapsed: !state.leftPanelCollapsed
      })),
      toggleRightPanel: () => set(state => ({
        rightPanelCollapsed: !state.rightPanelCollapsed
      })),
    }),
    {
      name: 'psd-viewer-ui', // localStorage key
      partialize: (state) => ({
        theme: state.theme, // 只持久化主题
      }),
    }
  )
);
