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

  // Actions
  setFguiDirectory: (handle: FileSystemDirectoryHandle) => void;
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
    
    clearFguiDirectory: () => {
      removeDirectoryHandle('fguiDirectoryHandle');
      set({ 
        fguiDirHandle: null,
        fguiProjectName: null 
      });
    },

    restoreFguiDirectory: async () => {
      const handle = await loadDirectoryHandle('fguiDirectoryHandle');
      if (handle) {
        // 尝试请求权限 (虽然在页面加载时可能无法直接请求，但有了句柄后，后续操作会触发)
        // 注意：这里只设置句柄，不请求权限，以免打扰用户
        set({ 
          fguiDirHandle: handle,
          fguiProjectName: handle.name 
        });
        console.log('[Config] 已恢复 FGUI 目录句柄:', handle.name);
      }
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
  })
);
