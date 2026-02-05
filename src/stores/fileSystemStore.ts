import { create } from 'zustand';

/**
 * 轻量级文件信息（不包含 File 对象，只存元数据）
 */
export interface PsdFileInfo {
  name: string;
  size: number;
  lastModified: number;
  relativePath: string;
}

/**
 * 文件句柄引用（用于懒加载时获取真实 File）
 */
export interface PsdFileHandle {
  info: PsdFileInfo;
  // 文件句柄（用于 File System Access API）
  fileHandle?: FileSystemFileHandle;
  // 传统模式下的 File 对象引用
  file?: File;
}

export interface DirectoryNode {
  name: string;
  path: string;
  files: PsdFileInfo[];
  children: DirectoryNode[];
}

interface FileSystemState {
  // 轻量级文件信息列表（只有元数据）
  files: PsdFileInfo[];
  // 文件句柄映射（relativePath -> handle）
  fileHandles: Map<string, PsdFileHandle>;
  directoryTree: DirectoryNode | null;
  isLoading: boolean;
  error: string | null;
  rootDirName: string;
  // 当前目录句柄（用于刷新）
  currentDirHandle: FileSystemDirectoryHandle | null;
  // 扫描进度
  scanProgress: { current: number; total: number } | null;
  
  // Actions
  setFiles: (files: PsdFileInfo[], handles: Map<string, PsdFileHandle>) => void;
  setDirectoryTree: (tree: DirectoryNode | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setRootDirName: (name: string) => void;
  setCurrentDirHandle: (handle: FileSystemDirectoryHandle | null) => void;
  setScanProgress: (progress: { current: number; total: number } | null) => void;
  clearFiles: () => void;
  // 获取文件 File 对象（懒加载）
  getFile: (relativePath: string) => Promise<File | null>;
}

// IndexedDB 存储目录句柄
const DB_NAME = 'PsdParserDB';
const STORE_NAME = 'directoryHandles';
const HANDLE_KEY = 'lastDirectoryHandle';
const EXPORT_HISTORY_STORE = 'exportHistory';

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); // 升级版本以添加新 store
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(EXPORT_HISTORY_STORE)) {
        db.createObjectStore(EXPORT_HISTORY_STORE);
      }
    };
  });
}

/**
 * 保存文件的导出历史
 */
export async function saveExportHistory(filePath: string, packageName: string, viewName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(EXPORT_HISTORY_STORE, 'readwrite');
    const store = tx.objectStore(EXPORT_HISTORY_STORE);
    store.put({ packageName, viewName, timestamp: Date.now() }, filePath);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * 加载文件的导出历史
 */
export async function loadExportHistory(filePath: string): Promise<{ packageName: string, viewName: string } | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(EXPORT_HISTORY_STORE, 'readonly');
      const store = tx.objectStore(EXPORT_HISTORY_STORE);
      const request = store.get(filePath);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle, key: string = HANDLE_KEY): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(handle, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDirectoryHandle(key: string = HANDLE_KEY): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function removeDirectoryHandle(key: string = HANDLE_KEY): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 构建目录树（使用轻量级 PsdFileInfo）
export function buildDirectoryTree(files: PsdFileInfo[], rootName: string): DirectoryNode {
  const root: DirectoryNode = {
    name: rootName,
    path: '',
    files: [],
    children: [],
  };

  for (const file of files) {
    const parts = file.relativePath.split('/').filter(Boolean);
    let current = root;

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

    current.files.push(file);
  }

  const sortNode = (node: DirectoryNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.name.localeCompare(b.name));
    node.children.forEach(sortNode);
  };
  sortNode(root);

  return root;
}

export const useFileSystemStore = create<FileSystemState>((set, get) => ({
  files: [],
  fileHandles: new Map(),
  directoryTree: null,
  isLoading: false,
  error: null,
  rootDirName: '',
  currentDirHandle: null,
  scanProgress: null,
  
  setFiles: (files, handles) => set({ files, fileHandles: handles }),
  setDirectoryTree: (tree) => set({ directoryTree: tree }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setRootDirName: (name) => set({ rootDirName: name }),
  setCurrentDirHandle: (handle) => set({ currentDirHandle: handle }),
  setScanProgress: (progress) => set({ scanProgress: progress }),
  clearFiles: () => set({ 
    files: [], 
    fileHandles: new Map(),
    directoryTree: null, 
    error: null, 
    rootDirName: '',
    currentDirHandle: null,
    scanProgress: null,
  }),
  
  // 懒加载获取 File 对象
  getFile: async (relativePath: string): Promise<File | null> => {
    const handle = get().fileHandles.get(relativePath);
    if (!handle) return null;
    
    // 如果有缓存的 File 对象，直接返回
    if (handle.file) {
      return handle.file;
    }
    
    // 使用 FileSystemFileHandle 获取 File
    if (handle.fileHandle) {
      try {
        const file = await handle.fileHandle.getFile();
        // 更新缓存（注意：这里不会触发重新渲染，只是内存缓存）
        handle.file = file;
        return file;
      } catch (err) {
        console.error('[FileSystem] 获取文件失败:', err);
        return null;
      }
    }
    
    return null;
  },
}));
