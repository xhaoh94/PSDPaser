import { useState, useCallback } from 'react';

export interface PsdFile {
  name: string;
  size: number;
  file: File;
  lastModified: number;
}

interface UseFileSystemReturn {
  files: PsdFile[];
  isLoading: boolean;
  error: string | null;
  selectDirectory: () => Promise<void>;
  selectFile: () => Promise<void>;
  clearFiles: () => void;
  supportsDirectoryPicker: boolean;
}

/**
 * 文件选择 Hook
 * 优先使用 File System Access API，降级使用传统 input
 */
export function useFileSystem(): UseFileSystemReturn {
  const [files, setFiles] = useState<PsdFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 检查是否支持 File System Access API
  const supportsDirectoryPicker = 'showDirectoryPicker' in window;

  // 过滤 PSD 文件
  const filterPsdFiles = (fileList: File[]): PsdFile[] => {
    return fileList
      .filter(file => file.name.toLowerCase().endsWith('.psd'))
      .map(file => ({
        name: file.name,
        size: file.size,
        file,
        lastModified: file.lastModified,
      }));
  };

  // 使用 File System Access API 选择目录
  const selectDirectoryWithAPI = async (): Promise<PsdFile[]> => {
    try {
      // @ts-expect-error showDirectoryPicker is not in all TypeScript definitions
      const dirHandle = await window.showDirectoryPicker();
      const psdFiles: File[] = [];

      // 递归遍历目录
      async function* getFilesRecursively(
        dirHandle: FileSystemDirectoryHandle
      ): AsyncGenerator<File> {
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            yield file;
          } else if (entry.kind === 'directory') {
            yield* getFilesRecursively(entry);
          }
        }
      }

      for await (const file of getFilesRecursively(dirHandle)) {
        if (file.name.toLowerCase().endsWith('.psd')) {
          psdFiles.push(file);
        }
      }

      return filterPsdFiles(psdFiles);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 用户取消选择
        return [];
      }
      throw err;
    }
  };

  // 使用传统 input 选择目录
  const selectDirectoryWithInput = (): Promise<PsdFile[]> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.multiple = true;

      input.onchange = () => {
        const fileList = Array.from(input.files || []);
        resolve(filterPsdFiles(fileList));
      };

      input.onerror = () => {
        reject(new Error('文件选择失败'));
      };

      // 用户取消不触发 change 事件，使用 focus 检测
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
  };

  // 选择目录
  const selectDirectory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const psdFiles = supportsDirectoryPicker
        ? await selectDirectoryWithAPI()
        : await selectDirectoryWithInput();

      if (psdFiles.length === 0) {
        setError('未找到 PSD 文件');
      } else {
        setFiles(psdFiles);
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
          resolve(filterPsdFiles(fileList));
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
    setError(null);
  }, []);

  return {
    files,
    isLoading,
    error,
    selectDirectory,
    selectFile,
    clearFiles,
    supportsDirectoryPicker,
  };
}
