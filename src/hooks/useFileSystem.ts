import { useState, useCallback, useEffect } from 'react';

export interface PsdFile {
  name: string;
  size: number;
  file: File;
  lastModified: number;
  // 相对路径（用于目录树显示）
  relativePath: string;
}

// 目录树节点
export interface DirectoryNode {
  name: string;
  path: string;
  files: PsdFile[];
  children: DirectoryNode[];
}

interface UseFileSystemReturn {
  files: PsdFile[];
  directoryTree: DirectoryNode | null;
  isLoading: boolean;
  error: string | null;
  selectDirectory: () => Promise<void>;
  selectFile: () => Promise<void>;
  clearFiles: () => void;
  supportsDirectoryPicker: boolean;
  lastSelectedFileName: string | null;
  setLastSelectedFileName: (name: string | null) => void;
}

// IndexedDB 存储目录句柄
const DB_NAME = 'PsdParserDB';
const STORE_NAME = 'directoryHandles';
const HANDLE_KEY = 'lastDirectoryHandle';
const LAST_FILE_KEY = 'lastSelectedFile';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

// localStorage 存储上次选中的文件名
function saveLastFileName(name: string | null): void {
  if (name) {
    localStorage.setItem(LAST_FILE_KEY, name);
  } else {
    localStorage.removeItem(LAST_FILE_KEY);
  }
}

function loadLastFileName(): string | null {
  return localStorage.getItem(LAST_FILE_KEY);
}

// 构建目录树
function buildDirectoryTree(files: PsdFile[], rootName: string): DirectoryNode {
  const root: DirectoryNode = {
    name: rootName,
    path: '',
    files: [],
    children: [],
  };

  for (const file of files) {
    const parts = file.relativePath.split('/').filter(Boolean);
    let current = root;

    // 遍历路径，创建目录节点
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i];
      let child = current.children.find(c => c.name === dirName);
      if (!child) {
        child = {
          name: dirName,
          path: parts.slice(0, i + 1).join('/'),
          files: [],
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }

    // 添加文件到当前目录
    current.files.push(file);
  }

  // 排序：目录在前，文件在后
  const sortNode = (node: DirectoryNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.name.localeCompare(b.name));
    node.children.forEach(sortNode);
  };
  sortNode(root);

  return root;
}

/**
 * 文件选择 Hook
 * 优先使用 File System Access API，降级使用传统 input
 * 支持记忆上次选择的目录和文件
 */
export function useFileSystem(): UseFileSystemReturn {
  const [files, setFiles] = useState<PsdFile[]>([]);
  const [directoryTree, setDirectoryTree] = useState<DirectoryNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSelectedFileName, setLastSelectedFileNameState] = useState<string | null>(null);
  const [rootDirName, setRootDirName] = useState<string>('');

  // 检查是否支持 File System Access API
  const supportsDirectoryPicker = 'showDirectoryPicker' in window;

  // 设置并保存上次选中的文件名
  const setLastSelectedFileName = useCallback((name: string | null) => {
    setLastSelectedFileNameState(name);
    saveLastFileName(name);
  }, []);

  // 更新目录树
  useEffect(() => {
    if (files.length > 0 && rootDirName) {
      setDirectoryTree(buildDirectoryTree(files, rootDirName));
    } else {
      setDirectoryTree(null);
    }
  }, [files, rootDirName]);

  // 从目录句柄读取文件（带相对路径）
  const readFilesFromHandle = async (dirHandle: FileSystemDirectoryHandle): Promise<PsdFile[]> => {
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
  };

  // 页面加载时恢复上次的目录
  useEffect(() => {
    const restoreLastDirectory = async () => {
      if (!supportsDirectoryPicker) return;

      try {
        const handle = await loadDirectoryHandle();
        if (!handle) return;

        // 请求权限
        // @ts-expect-error requestPermission is not in all TypeScript definitions
        const permission = await handle.requestPermission({ mode: 'read' });
        if (permission !== 'granted') {
          console.log('[FileSystem] 用户拒绝了目录访问权限');
          return;
        }

        setIsLoading(true);
        setRootDirName(handle.name);
        const psdFiles = await readFilesFromHandle(handle);
        
        if (psdFiles.length > 0) {
          setFiles(psdFiles);
          console.log('[FileSystem] 已恢复上次的目录，找到', psdFiles.length, '个 PSD 文件');
          
          // 恢复上次选中的文件名
          const lastName = loadLastFileName();
          if (lastName) {
            setLastSelectedFileNameState(lastName);
          }
        }
      } catch (err) {
        console.log('[FileSystem] 恢复目录失败:', (err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    restoreLastDirectory();
  }, [supportsDirectoryPicker]);

  // 使用 File System Access API 选择目录
  const selectDirectoryWithAPI = async (): Promise<{ files: PsdFile[]; rootName: string }> => {
    try {
      // @ts-expect-error showDirectoryPicker is not in all TypeScript definitions
      const dirHandle = await window.showDirectoryPicker();
      
      // 保存句柄以便下次恢复
      await saveDirectoryHandle(dirHandle);
      
      const files = await readFilesFromHandle(dirHandle);
      return { files, rootName: dirHandle.name };
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 用户取消选择
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
            // webkitRelativePath 包含完整路径
            relativePath: file.webkitRelativePath || file.name,
          }));
        
        // 从第一个文件提取根目录名
        const rootName = psdFiles[0]?.relativePath.split('/')[0] || '';
        resolve({ files: psdFiles, rootName });
      };

      input.onerror = () => {
        reject(new Error('文件选择失败'));
      };

      // 用户取消不触发 change 事件，使用 focus 检测
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
    setIsLoading(true);
    setError(null);

    try {
      const result = supportsDirectoryPicker
        ? await selectDirectoryWithAPI()
        : await selectDirectoryWithInput();

      if (result.files.length === 0) {
        setError('未找到 PSD 文件');
      } else {
        setFiles(result.files);
        setRootDirName(result.rootName);
      }
    } catch (err) {
      setError((err as Error).message || '选择目录失败');
    } finally {
      setIsLoading(false);
    }
  }, [supportsDirectoryPicker]);

  // 选择单个文件
  const selectFile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

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
        setFiles(psdFiles);
        setRootDirName('');
      }
    } catch (err) {
      setError((err as Error).message || '选择文件失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 清空文件列表
  const clearFiles = useCallback(() => {
    setFiles([]);
    setDirectoryTree(null);
    setError(null);
  }, []);

  return {
    files,
    directoryTree,
    isLoading,
    error,
    selectDirectory,
    selectFile,
    clearFiles,
    supportsDirectoryPicker,
    lastSelectedFileName,
    setLastSelectedFileName,
  };
}
