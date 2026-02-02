import { useCallback, useEffect } from 'react';
import { 
  useFileSystemStore, 
  loadDirectoryHandle, 
  saveDirectoryHandle, 
  loadLastFileName,
  buildDirectoryTree,
  type PsdFile,
  type DirectoryNode
} from '../stores/fileSystemStore';

interface UseFileSystemReturn {
  files: PsdFile[];
  directoryTree: DirectoryNode | null;
  isLoading: boolean;
  error: string | null;
  selectDirectory: () => Promise<void>;
  selectFile: () => Promise<void>;
  refreshDirectory: () => Promise<void>;
  clearFiles: () => void;
  supportsDirectoryPicker: boolean;
  lastSelectedFileName: string | null;
  setLastSelectedFileName: (name: string | null) => void;
}

// 从目录句柄读取文件
async function readFilesFromHandle(dirHandle: FileSystemDirectoryHandle): Promise<PsdFile[]> {
  const psdFiles: PsdFile[] = [];

  async function* getFilesRecursively(
    dirHandle: FileSystemDirectoryHandle,
    path: string = ''
  ): AsyncGenerator<{ file: File; relativePath: string }> {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        const relativePath = path ? `${path}/${file.name}` : file.name;
        yield { file, relativePath };
      } else if (entry.kind === 'directory') {
        const subPath = path ? `${path}/${entry.name}` : entry.name;
        yield* getFilesRecursively(entry, subPath);
      }
    }
  }

  for await (const { file, relativePath } of getFilesRecursively(dirHandle)) {
    if (file.name.toLowerCase().endsWith('.psd')) {
      psdFiles.push({
        name: file.name,
        size: file.size,
        file,
        lastModified: file.lastModified,
        relativePath,
      });
    }
  }

  return psdFiles;
}

export function useFileSystem(): UseFileSystemReturn {
  const store = useFileSystemStore();
  const supportsDirectoryPicker = 'showDirectoryPicker' in window;

  // 更新目录树 when files or rootDirName change
  useEffect(() => {
    if (store.files.length > 0 && store.rootDirName) {
      store.setDirectoryTree(buildDirectoryTree(store.files, store.rootDirName));
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
        const psdFiles = await readFilesFromHandle(handle);
        
        if (psdFiles.length > 0) {
          store.setFiles(psdFiles);
          console.log('[FileSystem] 已恢复上次的目录，找到', psdFiles.length, '个 PSD 文件');
          
          const lastName = loadLastFileName();
          if (lastName) {
            store.setLastSelectedFileName(lastName);
          }
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
  const selectDirectoryWithAPI = async (): Promise<{ files: PsdFile[]; rootName: string }> => {
    try {
      // @ts-expect-error showDirectoryPicker is not in all TypeScript definitions
      const dirHandle = await window.showDirectoryPicker();
      
      await saveDirectoryHandle(dirHandle);
      
      const files = await readFilesFromHandle(dirHandle);
      return { files, rootName: dirHandle.name };
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return { files: [], rootName: '' };
      }
      throw err;
    }
  };

  // 使用传统 input 选择目录
  const selectDirectoryWithInput = (): Promise<{ files: PsdFile[]; rootName: string }> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.multiple = true;

      input.onchange = () => {
        const fileList = Array.from(input.files || []);
        const psdFiles = fileList
          .filter(file => file.name.toLowerCase().endsWith('.psd'))
          .map(file => ({
            name: file.name,
            size: file.size,
            file,
            lastModified: file.lastModified,
            relativePath: file.webkitRelativePath || file.name,
          }));
        
        const rootName = psdFiles[0]?.relativePath.split('/')[0] || '';
        resolve({ files: psdFiles, rootName });
      };

      input.onerror = () => {
        reject(new Error('文件选择失败'));
      };

      const handleFocus = () => {
        setTimeout(() => {
          if (!input.files || input.files.length === 0) {
            resolve({ files: [], rootName: '' });
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

    try {
      const result = supportsDirectoryPicker
        ? await selectDirectoryWithAPI()
        : await selectDirectoryWithInput();

      if (result.files.length === 0 && result.rootName === '') {
        // User cancelled - don't show error
        return;
      }
      
      if (result.files.length === 0) {
        store.setError('未找到 PSD 文件');
      } else {
        store.setFiles(result.files);
        store.setRootDirName(result.rootName);
      }
    } catch (err) {
      store.setError((err as Error).message || '选择目录失败');
    } finally {
      store.setIsLoading(false);
    }
  }, [supportsDirectoryPicker]);

  // 选择单个文件
  const selectFile = useCallback(async () => {
    store.setIsLoading(true);
    store.setError(null);

    try {
      const psdFiles = await new Promise<PsdFile[]>((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.psd';
        input.multiple = true;

        input.onchange = () => {
          const fileList = Array.from(input.files || []);
          const files = fileList
            .filter(file => file.name.toLowerCase().endsWith('.psd'))
            .map(file => ({
              name: file.name,
              size: file.size,
              file,
              lastModified: file.lastModified,
              relativePath: file.name,
            }));
          resolve(files);
        };

        input.onerror = () => {
          reject(new Error('文件选择失败'));
        };

        const handleFocus = () => {
          setTimeout(() => {
            if (!input.files || input.files.length === 0) {
              resolve([]);
            }
            window.removeEventListener('focus', handleFocus);
          }, 500);
        };
        window.addEventListener('focus', handleFocus);

        input.click();
      });

      if (psdFiles.length > 0) {
        store.setFiles(psdFiles);
        store.setRootDirName('');
      }
    } catch (err) {
      store.setError((err as Error).message || '选择文件失败');
    } finally {
      store.setIsLoading(false);
    }
  }, []);

  // 刷新当前目录
  const refreshDirectory = useCallback(async () => {
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

      store.setIsLoading(true);
      store.setError(null);
      
      const psdFiles = await readFilesFromHandle(handle);
      store.setFiles(psdFiles);
      store.setRootDirName(handle.name);
      
      console.log('[FileSystem] 已刷新目录，找到', psdFiles.length, '个 PSD 文件');
    } catch (err) {
      store.setError((err as Error).message || '刷新目录失败');
    } finally {
      store.setIsLoading(false);
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
    lastSelectedFileName: store.lastSelectedFileName,
    setLastSelectedFileName: store.setLastSelectedFileName,
  };
}

// Re-export types
export type { PsdFile, DirectoryNode } from '../stores/fileSystemStore';
