import { create } from 'zustand';
import { saveDirectoryHandle, loadDirectoryHandle, removeDirectoryHandle } from './fileSystemStore';

export interface NamingRules {
  prefixes: {
    common: string; // "Common@"
  };
  suffixes: {
    noExport: string; // "@NoExport"
    img: string; // "@img" (Loader)
    input: string; // "@txt" (InputText)
    rich: string; // "@rich" (RichText)
  };
  componentPrefix: {
    [key: string]: {
      type: string;
      prefix: string;
    };
  };
}

interface ServerConfig {
  fguiProjectDir?: string; // 提示用的路径
  enabled?: boolean; // 是否启用
  namingRules?: NamingRules; // 自定义命名规则
}

interface ConfigState {
  // FGUI 项目根目录名称（仅用于显示）
  fguiProjectName: string | null;
  // 目录句柄
  fguiDirHandle: FileSystemDirectoryHandle | null;
  
  // 大图阈值 (像素)
  largeImageThreshold: number;
  
  // 本地目录扫描到的配置 (废弃或保留作为双重检查)
  hasLocalConfigFile: boolean;
  
  // 服务器端加载的配置
  serverConfig: ServerConfig | null;

  // FGUI Handles
  fguiCommonPaths: FileSystemDirectoryHandle[];
  fguiBigFileDirHandle: FileSystemDirectoryHandle | null;

  // UGUI Handles
  uguiSpriteDirHandle: FileSystemDirectoryHandle | null;
  uguiOutputDirHandle: FileSystemDirectoryHandle | null;
  // UGUI 公共路径数组（支持多个）
  uguiCommonPaths: FileSystemDirectoryHandle[];
  // UGUI BigFile 路径（大图导出目录）
  uguiBigFileDirHandle: FileSystemDirectoryHandle | null;
  // UGUI 字体目录句柄
  uguiFontDirHandle: FileSystemDirectoryHandle | null;

  // Actions
  setFguiDirectory: (handle: FileSystemDirectoryHandle) => void;
  setFguiBigFileDirectory: (handle: FileSystemDirectoryHandle) => void;
  addFguiCommonPath: (handle: FileSystemDirectoryHandle) => void;
  removeFguiCommonPath: (index: number) => void;
  
  setUguiSpriteDirectory: (handle: FileSystemDirectoryHandle) => void;
  setUguiOutputDirectory: (handle: FileSystemDirectoryHandle) => void;
  setUguiBigFileDirectory: (handle: FileSystemDirectoryHandle) => void;
  setUguiFontDirectory: (handle: FileSystemDirectoryHandle) => void;
  addUguiCommonPath: (handle: FileSystemDirectoryHandle) => void;
  removeUguiCommonPath: (index: number) => void;
  restoreUguiDirectories: () => Promise<void>;
  clearFguiDirectory: () => void;
  restoreFguiDirectory: () => Promise<void>;
  setLargeImageThreshold: (threshold: number) => void;
  setHasLocalConfigFile: (exists: boolean) => void;
  fetchServerConfig: () => Promise<void>;
  getNamingRules: () => NamingRules | undefined;
}

export const useConfigStore = create<ConfigState>()(
  (set, get) => ({
    fguiProjectName: null,
    fguiDirHandle: null,
    fguiCommonPaths: [],
    fguiBigFileDirHandle: null,
    
    uguiSpriteDirHandle: null,
    uguiOutputDirHandle: null,
    uguiCommonPaths: [],
    uguiBigFileDirHandle: null,
    uguiFontDirHandle: null,
    largeImageThreshold: 512,
    hasLocalConfigFile: false,
    serverConfig: null,

    setFguiDirectory: (handle) => {
      saveDirectoryHandle(handle, 'fguiDirectoryHandle');
      set({ 
        fguiDirHandle: handle,
        fguiProjectName: handle.name 
      });
    },
    
    setFguiBigFileDirectory: (handle) => {
      saveDirectoryHandle(handle, 'fguiBigFileDirHandle');
      set({ fguiBigFileDirHandle: handle });
      console.log('[Config] Set FGUI BigFile Dir:', handle.name);
    },
    
    addFguiCommonPath: (handle) => {
      const currentPaths = get().fguiCommonPaths;
      const newIndex = currentPaths.length;
      saveDirectoryHandle(handle, `fguiCommonPath_${newIndex}`);
      set({ fguiCommonPaths: [...currentPaths, handle] });
      console.log('[Config] Added FGUI Common Path:', handle.name, 'at index', newIndex);
    },
    
    removeFguiCommonPath: (index) => {
      const currentPaths = get().fguiCommonPaths;
      if (index < 0 || index >= currentPaths.length) return;
      
      const newPaths = [...currentPaths.slice(0, index), ...currentPaths.slice(index + 1)];
      
      // 重新保存索引
      removeDirectoryHandle(`fguiCommonPath_${index}`);
      newPaths.forEach((handle, i) => {
        saveDirectoryHandle(handle, `fguiCommonPath_${i}`);
      });
      
      set({ fguiCommonPaths: newPaths });
      console.log('[Config] Removed FGUI Common Path at index', index);
    },
    
    clearFguiDirectory: () => {
      removeDirectoryHandle('fguiDirectoryHandle');
      set({ 
        fguiDirHandle: null,
        fguiProjectName: null 
      });
    },

    restoreFguiDirectory: async () => {
      const handle = await loadDirectoryHandle('fguiDirectoryHandle');
      const bigFileHandle = await loadDirectoryHandle('fguiBigFileDirHandle');
      
      // 恢复公共路径（支持多个）
      const commonPaths: FileSystemDirectoryHandle[] = [];
      let index = 0;
      while (true) {
        const h = await loadDirectoryHandle(`fguiCommonPath_${index}`);
        if (!h) break;
        commonPaths.push(h);
        index++;
      }

      if (handle) {
        set({ 
          fguiDirHandle: handle,
          fguiProjectName: handle.name,
          fguiBigFileDirHandle: bigFileHandle,
          fguiCommonPaths: commonPaths
        });
        console.log('[Config] 已恢复 FGUI 目录句柄:', handle.name);
      }
      
      if (bigFileHandle) console.log('[Config] Restored FGUI BigFile Dir:', bigFileHandle.name);
      if (commonPaths.length > 0) console.log('[Config] Restored', commonPaths.length, 'FGUI Common Paths');
    },

    setLargeImageThreshold: (threshold) => set({ largeImageThreshold: threshold }),
    setHasLocalConfigFile: (exists) => set({ hasLocalConfigFile: exists }),
    
    fetchServerConfig: async () => {
      try {
        const response = await fetch('/fgui.json');
        if (response.ok) {
          const config = await response.json();
          // 如果配置文件存在，默认视为启用
          if (config.enabled === undefined) config.enabled = true;
          set({ serverConfig: config });
          console.log('[Config] 加载服务器配置成功:', config);
        } else {
          set({ serverConfig: null });
        }
      } catch (e) {
        // 文件不存在或解析失败，视为未配置
        set({ serverConfig: null });
      }
    },
    
    getNamingRules: () => {
      return get().serverConfig?.namingRules;
    },

    setUguiSpriteDirectory: (handle) => {
      saveDirectoryHandle(handle, 'uguiSpriteDirHandle');
      set({ uguiSpriteDirHandle: handle });
    },

    setUguiOutputDirectory: (handle) => {
      saveDirectoryHandle(handle, 'uguiOutputDirHandle');
      set({ uguiOutputDirHandle: handle });
    },

    restoreUguiDirectories: async () => {
      const spriteHandle = await loadDirectoryHandle('uguiSpriteDirHandle');
      const outputHandle = await loadDirectoryHandle('uguiOutputDirHandle');
      const bigFileHandle = await loadDirectoryHandle('uguiBigFileDirHandle');
      const fontHandle = await loadDirectoryHandle('uguiFontDirHandle');
      
      // 恢复公共路径（支持多个）
      const commonPaths: FileSystemDirectoryHandle[] = [];
      let index = 0;
      while (true) {
        const handle = await loadDirectoryHandle(`uguiCommonPath_${index}`);
        if (!handle) break;
        commonPaths.push(handle);
        index++;
      }
      
      set({
        uguiSpriteDirHandle: spriteHandle,
        uguiOutputDirHandle: outputHandle,
        uguiBigFileDirHandle: bigFileHandle,
        uguiFontDirHandle: fontHandle,
        uguiCommonPaths: commonPaths
      });
      
      if (spriteHandle) console.log('[Config] Restored UGUI Sprite Dir:', spriteHandle.name);
      if (outputHandle) console.log('[Config] Restored UGUI Output Dir:', outputHandle.name);
      if (bigFileHandle) console.log('[Config] Restored UGUI BigFile Dir:', bigFileHandle.name);
      if (fontHandle) console.log('[Config] Restored UGUI Font Dir:', fontHandle.name);
      if (commonPaths.length > 0) console.log('[Config] Restored', commonPaths.length, 'UGUI Common Paths');
    },
    
    setUguiBigFileDirectory: (handle) => {
      saveDirectoryHandle(handle, 'uguiBigFileDirHandle');
      set({ uguiBigFileDirHandle: handle });
      console.log('[Config] Set UGUI BigFile Dir:', handle.name);
    },
    
    setUguiFontDirectory: (handle) => {
      saveDirectoryHandle(handle, 'uguiFontDirHandle');
      set({ uguiFontDirHandle: handle });
      console.log('[Config] Set UGUI Font Dir:', handle.name);
    },
    
    addUguiCommonPath: (handle) => {
      const currentPaths = get().uguiCommonPaths;
      const newIndex = currentPaths.length;
      saveDirectoryHandle(handle, `uguiCommonPath_${newIndex}`);
      set({ uguiCommonPaths: [...currentPaths, handle] });
      console.log('[Config] Added UGUI Common Path:', handle.name, 'at index', newIndex);
    },
    
    removeUguiCommonPath: (index) => {
      const currentPaths = get().uguiCommonPaths;
      if (index < 0 || index >= currentPaths.length) return;
      
      const newPaths = [...currentPaths.slice(0, index), ...currentPaths.slice(index + 1)];
      
      // 重新保存索引
      removeDirectoryHandle(`uguiCommonPath_${index}`);
      newPaths.forEach((handle, i) => {
        saveDirectoryHandle(handle, `uguiCommonPath_${i}`);
      });
      
      set({ uguiCommonPaths: newPaths });
      console.log('[Config] Removed UGUI Common Path at index', index);
    },
  })
);
