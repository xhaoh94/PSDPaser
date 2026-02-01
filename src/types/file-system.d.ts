// File System Access API types
declare global {
  interface FileSystemDirectoryHandle {
    kind: 'directory';
    name: string;
    values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemFileHandle {
    kind: 'file';
    name: string;
    getFile(): Promise<File>;
  }

  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

export {};
