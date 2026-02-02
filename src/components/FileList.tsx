import React, { useEffect, useState, useMemo } from 'react';
import { Empty, Spin, Alert, Tree, Button, Tooltip, Input, Select } from 'antd';
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
import type { PsdFile, DirectoryNode } from '../hooks/useFileSystem';
import type { DataNode } from 'antd/es/tree';

interface FileListProps {
  onFileSelect?: (file: PsdFile) => void;
  selectedFile?: PsdFile | null;
}

type SortType = 'name' | 'modified';

/**
 * 文件列表组件
 */
export const FileList: React.FC<FileListProps> = ({ onFileSelect, selectedFile }) => {
  const {
    files,
    directoryTree,
    isLoading,
    error,
    lastSelectedFileName,
    setLastSelectedFileName,
  } = useFileSystem();

  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState('');
  const [sortType, setSortType] = useState<SortType>('name');

  // 递归获取所有目录 Key
  const getAllDirKeys = (node: DirectoryNode): string[] => {
    const keys: string[] = [];
    keys.push(`dir-${node.path}`);
    for (const child of node.children) {
      keys.push(...getAllDirKeys(child));
    }
    return keys;
  };

  // 过滤和排序文件
  const filteredAndSortedFiles = useMemo(() => {
    let result = [...files];
    
    // 模糊搜索过滤
    if (searchText.trim()) {
      const lowerSearch = searchText.toLowerCase();
      result = result.filter(file => 
        file.name.toLowerCase().includes(lowerSearch) ||
        file.relativePath.toLowerCase().includes(lowerSearch)
      );
    }
    
    // 排序
    result.sort((a, b) => {
      if (sortType === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        // 最近修改时间排序（降序，最新的在前）
        return b.lastModified - a.lastModified;
      }
    });
    
    return result;
  }, [files, searchText, sortType]);

  // 获取过滤后的目录树
  const filteredDirectoryTree = useMemo(() => {
    if (!directoryTree) return null;
    
    // 排序函数
    const sortFiles = (files: PsdFile[]) => {
      return [...files].sort((a, b) => {
        if (sortType === 'name') {
          return a.name.localeCompare(b.name);
        } else {
          return b.lastModified - a.lastModified;
        }
      });
    };
    
    // 获取目录内所有文件的最新修改时间（递归）
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
    
    // 排序目录
    const sortChildren = (children: DirectoryNode[]): DirectoryNode[] => {
      return [...children].sort((a, b) => {
        if (sortType === 'name') {
          return a.name.localeCompare(b.name);
        } else {
          // 按目录内最新文件的修改时间排序
          return getLatestModified(b) - getLatestModified(a);
        }
      });
    };
    
    // 递归过滤和排序目录树
    const processNode = (node: DirectoryNode, searchLower: string | null): DirectoryNode | null => {
      let processedChildren: DirectoryNode[] = [];
      
      for (const child of node.children) {
        const processedChild = processNode(child, searchLower);
        if (processedChild) {
          processedChildren.push(processedChild);
        }
      }
      
      // 排序子目录
      processedChildren = sortChildren(processedChildren);
      
      let processedFiles = node.files;
      
      // 如果有搜索条件，先过滤
      if (searchLower) {
        processedFiles = processedFiles.filter(file =>
          file.name.toLowerCase().includes(searchLower) ||
          file.relativePath.toLowerCase().includes(searchLower)
        );
      }
      
      // 排序文件
      processedFiles = sortFiles(processedFiles);
      
      // 如果是搜索模式，只返回有内容的节点
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
      
      // 非搜索模式，返回所有节点
      return {
        ...node,
        children: processedChildren,
        files: processedFiles,
      };
    };
    
    const searchLower = searchText.trim() ? searchText.toLowerCase() : null;
    return processNode(directoryTree, searchLower);
  }, [directoryTree, searchText, sortType]);

  const handleExpandAll = () => {
    if (filteredDirectoryTree) {
      const allKeys = ['root', ...getAllDirKeys(filteredDirectoryTree)];
      setExpandedKeys(allKeys);
    }
  };

  const handleCollapseAll = () => {
    setExpandedKeys([]);
  };

  const convertToTreeData = (node: DirectoryNode): DataNode[] => {
    const result: DataNode[] = [];

    // 添加子目录
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

    // 添加文件
    for (const file of node.files) {
      result.push({
        key: `file-${file.relativePath}`,
        title: (
          <span className="text-gray-700 whitespace-nowrap truncate block" style={{ maxWidth: 180 }} title={file.name}>
            {file.name}
          </span>
        ),
        icon: <FileImageOutlined className="text-blue-500" />,
        isLeaf: true,
      });
    }

    return result;
  };

  // 生成树数据
  const treeData: DataNode[] = filteredDirectoryTree
    ? [{
        key: 'root',
        title: <span className="font-bold text-gray-800 whitespace-nowrap">{filteredDirectoryTree.name || '已选目录'}</span>,
        icon: <FolderOpenOutlined className="text-yellow-500" />,
        children: convertToTreeData(filteredDirectoryTree),
        selectable: false,
      }]
    : filteredAndSortedFiles.map(file => ({
        key: `file-${file.relativePath}`,
        title: (
          <span className="text-gray-700 whitespace-nowrap truncate block" style={{ maxWidth: 180 }} title={file.name}>
            {file.name}
          </span>
        ),
        icon: <FileImageOutlined className="text-blue-500" />,
        isLeaf: true,
      }));

  // 处理树节点选择
  const handleSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) return;
    
    const key = selectedKeys[0] as string;
    if (!key.startsWith('file-')) return;

    const relativePath = key.replace('file-', '');
    const file = files.find(f => f.relativePath === relativePath);
    if (file) {
      setLastSelectedFileName(file.name);
      onFileSelect?.(file);
    }
  };

  // 初始化时只展开根目录（子目录默认折叠）
  useEffect(() => {
    if (filteredDirectoryTree && expandedKeys.length === 0) {
      setExpandedKeys(['root']);
    }
  }, [filteredDirectoryTree]);

  // 自动选中上次的文件
  useEffect(() => {
    if (files.length > 0 && lastSelectedFileName && !selectedFile) {
      const lastFile = files.find(f => f.name === lastSelectedFileName);
      if (lastFile) {
        console.log('[FileList] 自动恢复上次选中的文件:', lastFile.name);
        onFileSelect?.(lastFile);
      }
    }
  }, [files, lastSelectedFileName, selectedFile, onFileSelect]);

  // 获取选中的文件 key
  const selectedKeys = selectedFile
    ? [`file-${selectedFile.relativePath}`]
    : [];

  // 计算匹配的文件数量
  const matchCount = searchText.trim() ? filteredAndSortedFiles.length : files.length;

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

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Spin />
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

      {/* 文件树 */}
      {!isLoading && files.length > 0 && (
        <div className="flex-1 overflow-auto py-1">
          <Tree
            showIcon
            blockNode
            treeData={treeData}
            selectedKeys={selectedKeys}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys)}
            onSelect={handleSelect}
            className="file-tree"
          />
        </div>
      )}

      {/* 文件数量统计 */}
      {files.length > 0 && (
        <div className="h-6 flex items-center justify-center border-t border-gray-100 bg-white select-none">
          <span className="text-[10px] text-gray-400 font-medium">
            {searchText.trim() ? `${matchCount} / ${files.length} 个匹配` : `${files.length} 个项目`}
          </span>
        </div>
      )}
    </div>
  );
};
