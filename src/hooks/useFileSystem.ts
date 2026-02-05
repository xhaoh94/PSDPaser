import { useCallback, useEffect } from 'react';
import { 
  useFileSystemStore, 
  loadDirectoryHandle, 
  saveDirectoryHandle, 
  buildDirectoryTree,
  type PsdFileInfo,
  type PsdFileHandle,
  type DirectoryNode
} from '../stores/fileSystemStore';
import { useConfigStore } from '../stores/configStore';
import { psdCache } from '../utils/psdCache';

interface UseFileSystemReturn {
  files: PsdFileInfo[];
  directoryTree: DirectoryNode | null;
  isLoading: boolean;
  error: string | null;
  selectDirectory: () => Promise<void>;
  selectFile: () => Promise<void>;
  refreshDirectory: () => Promise<void>;
  clearFiles: () => void;
  supportsDirectoryPicker: boolean;
  getFile: (relativePath: string) => Promise<File | null>;
  scanProgress: { current: number; total: number } | null;
}

/**
 * 让出主线程，避免阻塞 UI
 */
function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    // 使用 setTimeout 让出主线程
    setTimeout(resolve, 0);
  });
}

/**
 * 高性能文件扫描器
 * - 分批处理，避免阻塞主线程
 * - 只获取文件名，不读取 File 对象
 * - 使用迭代而非递归，避免栈溢出
 */
async function scanFilesFromHandle(
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (current: number, total: number) => void
): Promise<{ files: PsdFileInfo[]; handles: Map<string, PsdFileHandle>; hasConfigFile: boolean }> {
  const files: PsdFileInfo[] = [];
  const handles = new Map<string, PsdFileHandle>();
  let hasConfigFile = false;
  
  // 第一阶段：快速收集所有 PSD 文件句柄（不获取 File 对象）
  const pendingFiles: Array<{ fileHandle: FileSystemFileHandle; relativePath: string; name: string }> = [];
  const queue: Array<{ handle: FileSystemDirectoryHandle; path: string }> = [
    { handle: dirHandle, path: '' }
  ];
  
  let dirCount = 0;
  
  while (queue.length > 0) {
    const { handle, path } = queue.shift()!;
    dirCount++;
    
    // 每处理 10 个目录让出一次主线程
    if (dirCount % 10 === 0) {
      await yieldToMain();
    }
    
    try {
      for await (const entry of handle.values()) {
        if (entry.kind === 'directory') {
          const subPath = path ? `${path}/${entry.name}` : entry.name;
          queue.push({ handle: entry as FileSystemDirectoryHandle, path: subPath });
        } else if (entry.kind === 'file') {
          const lowerName = entry.name.toLowerCase();
          
          if (lowerName.endsWith('.psd')) {
            const relativePath = path ? `${path}/${entry.name}` : entry.name;
            pendingFiles.push({
              fileHandle: entry as FileSystemFileHandle,
              relativePath,
              name: entry.name,
            });
          } else if (lowerName === 'fgui.json' || lowerName === 'fgui-config.json') {
            hasConfigFile = true;
          }
        }
      }
    } catch (err) {
      console.warn(`[FileSystem] 无法访问目录: ${path}`, err);
    }
  }
  
  const total = pendingFiles.length;
  onProgress?.(0, total);
  
  // 第二阶段：分批获取文件元数据
  const BATCH_SIZE = 50; // 每批处理 50 个文件
  
  for (let i = 0; i < pendingFiles.length; i += BATCH_SIZE) {
    const batch = pendingFiles.slice(i, i + BATCH_SIZE);
    
    // 并行处理当前批次
    await Promise.all(
      batch.map(async ({ fileHandle, relativePath, name }) => {
        try {
          // 获取文件元数据（这是必要的开销，但比读取内容快得多）
          const file = await fileHandle.getFile();
          const info: PsdFileInfo = {
            name,
            size: file.size,
            lastModified: file.lastModified,
            relativePath,
          };
          files.push(info);
          handles.set(relativePath, { info, fileHandle });
        } catch (err) {
          console.warn(`[FileSystem] 跳过无法访问的文件: ${relativePath}`, err);
        }
      })
    );
    
    // 更新进度并让出主线程
    onProgress?.(Math.min(i + BATCH_SIZE, total), total);
    await yieldToMain();
  }
  
  return { files, handles, hasConfigFile };
}

/**
 * 使用传统 input 选择目录（降级方案）
 */
function scanFilesFromInput(fileList: File[]): { files: PsdFileInfo[]; handles: Map<string, PsdFileHandle> } {
  const files: PsdFileInfo[] = [];
  const handles = new Map<string, PsdFileHandle>();
  
  for (const file of fileList) {
    if (!file.name.toLowerCase().endsWith('.psd')) continue;
    
    const relativePath = file.webkitRelativePath || file.name;
    const info: PsdFileInfo = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      relativePath,
    };
    files.push(info);
    handles.set(relativePath, { info, file });
  }
  
  return { files, handles };
}

export function useFileSystem(): UseFileSystemReturn {
  const store = useFileSystemStore();
  const { setHasLocalConfigFile } = useConfigStore();
  const supportsDirectoryPicker = 'showDirectoryPicker' in window;

  // 更新目录树 when files or rootDirName change
  useEffect(() => {
    if (store.files.length > 0 && store.rootDirName) {
      // 使用 requestIdleCallback 构建目录树，避免阻塞
      const buildTree = () => {
        const tree = buildDirectoryTree(store.files, store.rootDirName);
        store.setDirectoryTree(tree);
      };
      
      if ('requestIdleCallback' in window) {
        requestIdleCallback(buildTree, { timeout: 100 });
      } else {
        setTimeout(buildTree, 0);
      }
    } else {
      store.setDirectoryTree(null);
    }
  }, [store.files, store.rootDirName]);

  // 页面加载时恢复上次的目录
  useEffect(() => {
    const restoreLastDirectory = async () => {
      if (!supportsDirectoryPicker) return;

      try {
        const handle = await loadDirectoryHandle();
        if (!handle) return;

        // @ts-expect-error requestPermission is not in all TypeScript definitions
        const permission = await handle.requestPermission({ mode: 'read' });
        if (permission !== 'granted') {
          console.log('[FileSystem] 用户拒绝了目录访问权限');
          return;
        }

        store.setIsLoading(true);
        store.setRootDirName(handle.name);
        store.setCurrentDirHandle(handle);
        
        const { files, handles } = await scanFilesFromHandle(handle, (current, total) => {
          store.setScanProgress({ current, total });
        });
        
        store.setScanProgress(null);
        
        if (files.length > 0) {
          store.setFiles(files, handles);
          console.log('[FileSystem] 已恢复上次的目录，找到', files.length, '个 PSD 文件');
        }
      } catch (err) {
        console.log('[FileSystem] 恢复目录失败:', (err as Error).message);
      } finally {
        store.setIsLoading(false);
      }
    };

    restoreLastDirectory();
  }, [supportsDirectoryPicker]);

  // 使用 File System Access API 选择目录
  const selectDirectoryWithAPI = async (
    onProgress?: (current: number, total: number) => void
  ): Promise<{ files: PsdFileInfo[]; handles: Map<string, PsdFileHandle>; rootName: string; dirHandle: FileSystemDirectoryHandle; hasConfigFile: boolean } | null> => {
    try {
      // @ts-expect-error showDirectoryPicker is not in all TypeScript definitions
      const dirHandle = await window.showDirectoryPicker();
      
      await saveDirectoryHandle(dirHandle);
      
      const { files, handles, hasConfigFile } = await scanFilesFromHandle(dirHandle, onProgress);
      return { files, handles, rootName: dirHandle.name, dirHandle, hasConfigFile };
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return null;
      }
      throw err;
    }
  };

  // 使用传统 input 选择目录
  const selectDirectoryWithInput = (): Promise<{ files: PsdFileInfo[]; handles: Map<string, PsdFileHandle>; rootName: string } | null> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.multiple = true;

      input.onchange = () => {
        const fileList = Array.from(input.files || []);
        if (fileList.length === 0) {
          resolve(null);
          return;
        }
        
        const { files, handles } = scanFilesFromInput(fileList);
        const rootName = fileList[0]?.webkitRelativePath.split('/')[0] || '';
        resolve({ files, handles, rootName });
      };

      input.onerror = () => {
        reject(new Error('文件选择失败'));
      };

      const handleFocus = () => {
        setTimeout(() => {
          if (!input.files || input.files.length === 0) {
            resolve(null);
          }
          window.removeEventListener('focus', handleFocus);
        }, 500);
      };
      window.addEventListener('focus', handleFocus);

      input.click();
    });
  };

  // 选择目录
  const selectDirectory = useCallback(async () => {
    store.setIsLoading(true);
    store.setError(null);
    store.setScanProgress({ current: 0, total: 0 });

    try {
      const result = supportsDirectoryPicker
        ? await selectDirectoryWithAPI((current, total) => {
            store.setScanProgress({ current, total });
          })
        : await selectDirectoryWithInput();

      store.setScanProgress(null);

      if (!result) {
        return;
      }
      
      if (result.files.length === 0) {
        store.setError('未找到 PSD 文件');
      } else {
        store.setFiles(result.files, result.handles);
        store.setRootDirName(result.rootName);
        if ('dirHandle' in result && result.dirHandle) {
          store.setCurrentDirHandle(result.dirHandle as FileSystemDirectoryHandle);
        }
        
        // 更新配置文件状态
        if ('hasConfigFile' in result) {
          setHasLocalConfigFile(!!result.hasConfigFile);
        }
      }
    } catch (err) {
      store.setError((err as Error).message || '选择目录失败');
    } finally {
      store.setIsLoading(false);
      store.setScanProgress(null);
    }
  }, [supportsDirectoryPicker]);

  // 选择单个文件
  const selectFile = useCallback(async () => {
    store.setIsLoading(true);
    store.setError(null);

    try {
      const result = await new Promise<{ files: PsdFileInfo[]; handles: Map<string, PsdFileHandle> } | null>((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.psd';
        input.multiple = true;

        input.onchange = () => {
          const fileList = Array.from(input.files || []);
          if (fileList.length === 0) {
            resolve(null);
            return;
          }
          
          const { files, handles } = scanFilesFromInput(fileList);
          resolve({ files, handles });
        };

        input.onerror = () => {
          reject(new Error('文件选择失败'));
        };

        const handleFocus = () => {
          setTimeout(() => {
            if (!input.files || input.files.length === 0) {
              resolve(null);
            }
            window.removeEventListener('focus', handleFocus);
          }, 500);
        };
        window.addEventListener('focus', handleFocus);

        input.click();
      });

      if (result && result.files.length > 0) {
        store.setFiles(result.files, result.handles);
        store.setRootDirName('');
        store.setCurrentDirHandle(null);
      }
    } catch (err) {
      store.setError((err as Error).message || '选择文件失败');
    } finally {
      store.setIsLoading(false);
    }
  }, []);

  // 刷新当前目录
  const refreshDirectory = useCallback(async () => {
    // 刷新时清空缓存
    psdCache.clear();
    const currentHandle = store.currentDirHandle;
    
    if (!currentHandle) {
      if (!supportsDirectoryPicker) return;
      
      try {
        const handle = await loadDirectoryHandle();
        if (!handle) {
          store.setError('没有已保存的目录');
          return;
        }
        
        // @ts-expect-error requestPermission is not in all TypeScript definitions
        const permission = await handle.requestPermission({ mode: 'read' });
        if (permission !== 'granted') {
          store.setError('目录访问权限被拒绝');
          return;
        }
        
        store.setCurrentDirHandle(handle);
        store.setIsLoading(true);
        store.setError(null);
        store.setScanProgress({ current: 0, total: 0 });
        
        const { files, handles, hasConfigFile } = await scanFilesFromHandle(handle, (current, total) => {
          store.setScanProgress({ current, total });
        });
        
        store.setScanProgress(null);
        store.setFiles(files, handles);
        store.setRootDirName(handle.name);
        setHasLocalConfigFile(hasConfigFile);
        
        console.log('[FileSystem] 已刷新目录，找到', files.length, '个 PSD 文件');
      } catch (err) {
        store.setError((err as Error).message || '刷新目录失败');
      } finally {
        store.setIsLoading(false);
        store.setScanProgress(null);
      }
      return;
    }

    try {
      store.setIsLoading(true);
      store.setError(null);
      store.setScanProgress({ current: 0, total: 0 });
      
      const { files, handles, hasConfigFile } = await scanFilesFromHandle(currentHandle, (current, total) => {
        store.setScanProgress({ current, total });
      });
      
      store.setScanProgress(null);
      store.setFiles(files, handles);
      store.setRootDirName(currentHandle.name);
      setHasLocalConfigFile(hasConfigFile);
      
      console.log('[FileSystem] 已刷新目录，找到', files.length, '个 PSD 文件');
    } catch (err) {
      store.setError((err as Error).message || '刷新目录失败');
    } finally {
      store.setIsLoading(false);
      store.setScanProgress(null);
    }
  }, [supportsDirectoryPicker]);

  return {
    files: store.files,
    directoryTree: store.directoryTree,
    isLoading: store.isLoading,
    error: store.error,
    selectDirectory,
    selectFile,
    refreshDirectory,
    clearFiles: store.clearFiles,
    supportsDirectoryPicker,
    getFile: store.getFile,
    scanProgress: store.scanProgress,
  };
}

// Re-export types
export type { PsdFileInfo, PsdFileHandle, DirectoryNode } from '../stores/fileSystemStore';
