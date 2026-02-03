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
  
  // 鼠标在画布上的 PSD 坐标
  cursorPosition: { x: number; y: number };
  
  // 图层面板高度百分比 (0-100)
  layerPanelHeight: number;
  
  // 左侧栏宽度 (px)
  leftSiderWidth: number;

  // Actions
  setCursorPosition: (position: { x: number; y: number }) => void;
  setLayerPanelHeight: (height: number) => void;
  setLeftSiderWidth: (width: number) => void;
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
  // 居中画布
  centerCanvas: (docWidth: number, docHeight: number, containerWidth: number, containerHeight: number) => void;
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
      cursorPosition: { x: 0, y: 0 },
      layerPanelHeight: 50, // 默认 50%
      leftSiderWidth: 280, // 默认左侧栏宽度
      
      setCursorPosition: (position) => set({ cursorPosition: position }),
      setLayerPanelHeight: (height) => set({ layerPanelHeight: Math.max(10, Math.min(90, height)) }), // 限制在 10% - 90% 之间
      setLeftSiderWidth: (width) => set({ leftSiderWidth: Math.max(180, Math.min(500, width)) }), // 限制在 180px - 500px 之间
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
      
      centerCanvas: (docWidth, docHeight, containerWidth, containerHeight) => {
        // 计算合适的缩放比例，使画布适应容器（留出边距）
        const padding = 40;
        const availableWidth = containerWidth - padding * 2;
        const availableHeight = containerHeight - padding * 2;
        
        const scaleX = availableWidth / docWidth;
        const scaleY = availableHeight / docHeight;
        const fitScale = Math.min(scaleX, scaleY, 1); // 不超过100%
        
        // 计算居中偏移
        const scaledWidth = docWidth * fitScale;
        const scaledHeight = docHeight * fitScale;
        const offsetX = (containerWidth - scaledWidth) / 2;
        const offsetY = (containerHeight - scaledHeight) / 2;
        
        set({ 
          scale: fitScale,
          offset: { x: offsetX, y: offsetY }
        });
      },
    }),
      {
        name: 'psd-viewer-ui', // localStorage key
        partialize: (state) => ({
          theme: state.theme, // 只持久化主题
          layerPanelHeight: state.layerPanelHeight, // 持久化面板高度
          leftSiderWidth: state.leftSiderWidth, // 持久化左侧栏宽度
        }),
      }
  )
);
