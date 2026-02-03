import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Empty, Spin, Alert, Tree, Button, Tooltip, Input, Select, Progress } from 'antd';
import { 
  FileImageOutlined, 
  FolderOutlined, 
  FolderOpenOutlined, 
  ExpandAltOutlined, 
  CompressOutlined,
  SearchOutlined,
  SortAscendingOutlined
} from '@ant-design/icons';
import { useFileSystem } from '../hooks/useFileSystem';
import type { PsdFileInfo, DirectoryNode } from '../hooks/useFileSystem';
import type { DataNode } from 'antd/es/tree';

interface FileListProps {
  onFileSelect?: (file: PsdFileInfo) => void;
  selectedFile?: PsdFileInfo | null;
}

type SortType = 'name' | 'modified';

/**
 * 文件列表组件（高性能版本）
 * - 支持虚拟滚动
 * - 显示扫描进度
 * - 分批渲染大量文件
 */
export const FileList: React.FC<FileListProps> = ({ onFileSelect, selectedFile }) => {
  const {
    files,
    directoryTree,
    isLoading,
    error,
    scanProgress,
  } = useFileSystem();

  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState('');
  const [sortType, setSortType] = useState<SortType>('name');
  const [treeHeight, setTreeHeight] = useState(400);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // 递归获取所有目录 Key
  const getAllDirKeys = useCallback((node: DirectoryNode): string[] => {
    const keys: string[] = [];
    keys.push(`dir-${node.path}`);
    for (const child of node.children) {
      keys.push(...getAllDirKeys(child));
    }
    return keys;
  }, []);

  // 过滤和排序文件（使用 useMemo 优化）
  const filteredAndSortedFiles = useMemo(() => {
    let result = files;
    
    // 模糊搜索过滤
    if (searchText.trim()) {
      const lowerSearch = searchText.toLowerCase();
      result = result.filter(file => 
        file.name.toLowerCase().includes(lowerSearch) ||
        file.relativePath.toLowerCase().includes(lowerSearch)
      );
    }
    
    // 排序（创建新数组避免修改原数组）
    return [...result].sort((a, b) => {
      if (sortType === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        return b.lastModified - a.lastModified;
      }
    });
  }, [files, searchText, sortType]);

  // 获取过滤后的目录树（优化：只在需要时计算）
  const filteredDirectoryTree = useMemo(() => {
    if (!directoryTree) return null;
    
    const sortFiles = (files: PsdFileInfo[]) => {
      return [...files].sort((a, b) => {
        if (sortType === 'name') {
          return a.name.localeCompare(b.name);
        } else {
          return b.lastModified - a.lastModified;
        }
      });
    };
    
    const getLatestModified = (node: DirectoryNode): number => {
      let latest = 0;
      for (const file of node.files) {
        if (file.lastModified > latest) {
          latest = file.lastModified;
        }
      }
      for (const child of node.children) {
        const childLatest = getLatestModified(child);
        if (childLatest > latest) {
          latest = childLatest;
        }
      }
      return latest;
    };
    
    const sortChildren = (children: DirectoryNode[]): DirectoryNode[] => {
      return [...children].sort((a, b) => {
        if (sortType === 'name') {
          return a.name.localeCompare(b.name);
        } else {
          return getLatestModified(b) - getLatestModified(a);
        }
      });
    };
    
    const processNode = (node: DirectoryNode, searchLower: string | null): DirectoryNode | null => {
      let processedChildren: DirectoryNode[] = [];
      
      for (const child of node.children) {
        const processedChild = processNode(child, searchLower);
        if (processedChild) {
          processedChildren.push(processedChild);
        }
      }
      
      processedChildren = sortChildren(processedChildren);
      
      let processedFiles = node.files;
      
      if (searchLower) {
        processedFiles = processedFiles.filter(file =>
          file.name.toLowerCase().includes(searchLower) ||
          file.relativePath.toLowerCase().includes(searchLower)
        );
      }
      
      processedFiles = sortFiles(processedFiles);
      
      if (searchLower) {
        if (processedChildren.length > 0 || processedFiles.length > 0) {
          return {
            ...node,
            children: processedChildren,
            files: processedFiles,
          };
        }
        return null;
      }
      
      return {
        ...node,
        children: processedChildren,
        files: processedFiles,
      };
    };
    
    const searchLower = searchText.trim() ? searchText.toLowerCase() : null;
    return processNode(directoryTree, searchLower);
  }, [directoryTree, searchText, sortType]);

  const handleExpandAll = useCallback(() => {
    if (filteredDirectoryTree) {
      const allKeys = ['root', ...getAllDirKeys(filteredDirectoryTree)];
      setExpandedKeys(allKeys);
    }
  }, [filteredDirectoryTree, getAllDirKeys]);

  const handleCollapseAll = useCallback(() => {
    setExpandedKeys([]);
  }, []);

  // 转换为树数据（优化：使用迭代而非递归）
  const convertToTreeData = useCallback((node: DirectoryNode): DataNode[] => {
    const result: DataNode[] = [];

    for (const child of node.children) {
      result.push({
        key: `dir-${child.path}`,
        title: <span className="text-gray-700 whitespace-nowrap">{child.name}</span>,
        icon: (props: { expanded?: boolean }) => 
          props.expanded ? <FolderOpenOutlined className="text-yellow-500" /> : <FolderOutlined className="text-yellow-500" />,
        children: convertToTreeData(child),
        selectable: false,
      });
    }

    for (const file of node.files) {
      result.push({
        key: `file-${file.relativePath}`,
        title: (
          <span className="text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis block" title={file.name}>
            {file.name}
          </span>
        ),
        icon: <FileImageOutlined className="text-blue-500" />,
        isLeaf: true,
      });
    }

    return result;
  }, []);

  // 生成树数据
  const treeData: DataNode[] = useMemo(() => {
    if (filteredDirectoryTree) {
      return [{
        key: 'root',
        title: <span className="font-bold text-gray-800 whitespace-nowrap">{filteredDirectoryTree.name || '已选目录'}</span>,
        icon: <FolderOpenOutlined className="text-yellow-500" />,
        children: convertToTreeData(filteredDirectoryTree),
        selectable: false,
      }];
    }
    
    return filteredAndSortedFiles.map(file => ({
      key: `file-${file.relativePath}`,
      title: (
        <span className="text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis block" title={file.name}>
          {file.name}
        </span>
      ),
      icon: <FileImageOutlined className="text-blue-500" />,
      isLeaf: true,
    }));
  }, [filteredDirectoryTree, filteredAndSortedFiles, convertToTreeData]);

  // 处理树节点选择
  const handleSelect = useCallback((selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) return;
    
    const key = selectedKeys[0] as string;
    if (!key.startsWith('file-')) return;

    const relativePath = key.replace('file-', '');
    const file = files.find(f => f.relativePath === relativePath);
    if (file) {
      onFileSelect?.(file);
    }
  }, [files, onFileSelect]);

  // 初始化时只展开根目录
  useEffect(() => {
    if (filteredDirectoryTree && expandedKeys.length === 0) {
      setExpandedKeys(['root']);
    }
  }, [filteredDirectoryTree, expandedKeys.length]);

  // 监听容器大小变化，动态更新树高度
  useEffect(() => {
    const container = treeContainerRef.current;
    if (!container) return;

    const updateHeight = () => {
      const height = container.clientHeight;
      if (height > 0) {
        setTreeHeight(height);
      }
    };

    // 初始化高度
    updateHeight();

    // 使用 ResizeObserver 监听容器大小变化
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 获取选中的文件 key
  const selectedKeys = selectedFile
    ? [`file-${selectedFile.relativePath}`]
    : [];

  // 计算匹配的文件数量
  const matchCount = searchText.trim() ? filteredAndSortedFiles.length : files.length;

  // 计算扫描进度百分比
  const progressPercent = scanProgress && scanProgress.total > 0 
    ? Math.round((scanProgress.current / scanProgress.total) * 100) 
    : 0;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 错误提示 */}
      {error && (
        <Alert
          message={error}
          type="warning"
          showIcon
          className="m-2 text-xs"
        />
      )}

      {/* 扫描进度 */}
      {isLoading && scanProgress && scanProgress.total > 0 && (
        <div className="p-3 space-y-2">
          <div className="text-xs text-gray-500 text-center">
            正在扫描文件... {scanProgress.current} / {scanProgress.total}
          </div>
          <Progress 
            percent={progressPercent} 
            size="small" 
            status="active"
            strokeColor="#1890ff"
          />
        </div>
      )}

      {/* 加载状态（无进度时显示） */}
      {isLoading && (!scanProgress || scanProgress.total === 0) && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Spin />
          <span className="text-xs text-gray-400 mt-2">正在扫描目录...</span>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && files.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center opacity-50">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span className="text-gray-400 text-[10px]">
                空目录
              </span>
            }
          />
        </div>
      )}

      {/* 搜索和排序工具栏 */}
      {!isLoading && files.length > 0 && (
        <div className="px-2 py-2 border-b border-gray-100 bg-white sticky top-0 z-10 space-y-2">
          {/* 搜索框 */}
          <Input
            placeholder="搜索文件..."
            prefix={<SearchOutlined className="text-gray-400" />}
            size="small"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
            className="text-xs"
          />
          {/* 排序和展开/折叠 */}
          <div className="flex items-center justify-between">
            <Select
              size="small"
              value={sortType}
              onChange={setSortType}
              className="text-xs"
              style={{ width: 120 }}
              suffixIcon={<SortAscendingOutlined />}
              options={[
                { value: 'name', label: '按名称排序' },
                { value: 'modified', label: '按修改时间' },
              ]}
            />
            <div className="flex gap-1">
              <Tooltip title="全部展开">
                <Button type="text" size="small" icon={<ExpandAltOutlined className="text-xs" />} onClick={handleExpandAll} className="text-gray-400 hover:text-gray-600 h-6 w-6 min-w-0 flex items-center justify-center" />
              </Tooltip>
              <Tooltip title="全部折叠">
                <Button type="text" size="small" icon={<CompressOutlined className="text-xs" />} onClick={handleCollapseAll} className="text-gray-400 hover:text-gray-600 h-6 w-6 min-w-0 flex items-center justify-center" />
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* 文件树（使用虚拟滚动） */}
      {!isLoading && files.length > 0 && (
        <div ref={treeContainerRef} className="flex-1 overflow-auto py-1">
          <Tree
            showIcon
            blockNode
            treeData={treeData}
            selectedKeys={selectedKeys}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys)}
            onSelect={handleSelect}
            className="file-tree"
            virtual={files.length > 100} // 超过 100 个文件时启用虚拟滚动
            height={files.length > 100 ? treeHeight : undefined} // 虚拟滚动使用动态容器高度
          />
        </div>
      )}

      {/* 文件数量统计 */}
      {files.length > 0 && !isLoading && (
        <div className="h-6 flex items-center justify-center border-t border-gray-100 bg-white select-none shrink-0">
          <span className="text-[10px] text-gray-400 font-medium">
            {searchText.trim() ? `${matchCount} / ${files.length} 个匹配` : `${files.length} 个项目`}
          </span>
        </div>
      )}
    </div>
  );
};
