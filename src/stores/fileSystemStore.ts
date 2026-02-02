import { create } from 'zustand';

export interface PsdFile {
  name: string;
  size: number;
  file: File;
  lastModified: number;
  relativePath: string;
}

export interface DirectoryNode {
  name: string;
  path: string;
  files: PsdFile[];
  children: DirectoryNode[];
}

interface FileSystemState {
  files: PsdFile[];
  directoryTree: DirectoryNode | null;
  isLoading: boolean;
  error: string | null;
  rootDirName: string;
  lastSelectedFileName: string | null;
  
  // Actions
  setFiles: (files: PsdFile[]) => void;
  setDirectoryTree: (tree: DirectoryNode | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setRootDirName: (name: string) => void;
  setLastSelectedFileName: (name: string | null) => void;
  clearFiles: () => void;
}

// IndexedDB 存储目录句柄
const DB_NAME = 'PsdParserDB';
const STORE_NAME = 'directoryHandles';
const HANDLE_KEY = 'lastDirectoryHandle';
const LAST_FILE_KEY = 'lastSelectedFile';

export async function openDB(): Promise<IDBDatabase> {
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

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
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

export function saveLastFileName(name: string | null): void {
  if (name) {
    localStorage.setItem(LAST_FILE_KEY, name);
  } else {
    localStorage.removeItem(LAST_FILE_KEY);
  }
}

export function loadLastFileName(): string | null {
  return localStorage.getItem(LAST_FILE_KEY);
}

// 构建目录树
export function buildDirectoryTree(files: PsdFile[], rootName: string): DirectoryNode {
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

export const useFileSystemStore = create<FileSystemState>((set) => ({
  files: [],
  directoryTree: null,
  isLoading: false,
  error: null,
  rootDirName: '',
  lastSelectedFileName: loadLastFileName(),
  
  setFiles: (files) => set({ files }),
  setDirectoryTree: (tree) => set({ directoryTree: tree }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setRootDirName: (name) => set({ rootDirName: name }),
  setLastSelectedFileName: (name) => {
    saveLastFileName(name);
    set({ lastSelectedFileName: name });
  },
  clearFiles: () => set({ files: [], directoryTree: null, error: null, rootDirName: '' }),
}));
