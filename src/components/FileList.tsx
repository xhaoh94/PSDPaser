import React, { useEffect, useState } from 'react';
import { Empty, Spin, Alert, Tree, Button, Tooltip } from 'antd';
import { 
  FileImageOutlined, 
  FolderOutlined, 
  FolderOpenOutlined, 
  ExpandAltOutlined, 
  CompressOutlined 
} from '@ant-design/icons';
import { useFileSystem } from '../hooks/useFileSystem';
import type { PsdFile, DirectoryNode } from '../hooks/useFileSystem';
import type { DataNode } from 'antd/es/tree';

interface FileListProps {
  onFileSelect?: (file: PsdFile) => void;
  selectedFile?: PsdFile | null;
}

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

  // 递归获取所有目录 Key
  const getAllDirKeys = (node: DirectoryNode): string[] => {
    const keys: string[] = [];
    keys.push(`dir-${node.path}`);
    for (const child of node.children) {
      keys.push(...getAllDirKeys(child));
    }
    return keys;
  };

  const handleExpandAll = () => {
    if (directoryTree) {
      const allKeys = ['root', ...getAllDirKeys(directoryTree)];
      setExpandedKeys(allKeys);
    }
  };

  const handleCollapseAll = () => {
    setExpandedKeys([]);
  };

  // ... (keep convertToTreeData)
  const convertToTreeData = (node: DirectoryNode): DataNode[] => {
    const result: DataNode[] = [];

    // 添加子目录
    for (const child of node.children) {
      result.push({
        key: `dir-${child.path}`,
        title: <span className="text-gray-700">{child.name}</span>,
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
          <div className="flex items-center justify-between w-full pr-2">
            <span className="truncate flex-1 text-gray-700">{file.name}</span>
          </div>
        ),
        icon: <FileImageOutlined className="text-blue-500" />,
        isLeaf: true,
      });
    }

    return result;
  };

  // 生成树数据
  const treeData: DataNode[] = directoryTree
    ? [{
        key: 'root',
        title: <span className="font-bold text-gray-800">{directoryTree.name || '已选目录'}</span>,
        icon: <FolderOpenOutlined className="text-yellow-500" />,
        children: convertToTreeData(directoryTree),
        selectable: false,
      }]
    : files.map(file => ({
        key: `file-${file.relativePath}`,
        title: (
          <div className="flex items-center justify-between w-full pr-2">
            <span className="truncate flex-1 text-gray-700">{file.name}</span>
          </div>
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

  // 自动展开所有目录
  useEffect(() => {
    if (directoryTree) {
      setExpandedKeys(['root', ...getAllDirKeys(directoryTree)]);
    }
  }, [directoryTree]);

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

      {/* 工具栏 */}
      {!isLoading && files.length > 0 && (
        <div className="px-2 py-1 flex justify-end gap-1 border-b border-gray-50 bg-white sticky top-0 z-10">
           <Tooltip title="全部展开">
             <Button type="text" size="small" icon={<ExpandAltOutlined className="text-xs" />} onClick={handleExpandAll} className="text-gray-400 hover:text-gray-600 h-6 w-6 min-w-0 flex items-center justify-center" />
           </Tooltip>
           <Tooltip title="全部折叠">
             <Button type="text" size="small" icon={<CompressOutlined className="text-xs" />} onClick={handleCollapseAll} className="text-gray-400 hover:text-gray-600 h-6 w-6 min-w-0 flex items-center justify-center" />
           </Tooltip>
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

      {/* 文件数量统计 - Mac Finder style */}
      {files.length > 0 && (
        <div className="h-6 flex items-center justify-center border-t border-gray-100 bg-white select-none">
          <span className="text-[10px] text-gray-400 font-medium">
            {files.length} 个项目
          </span>
        </div>
      )}
    </div>
  );
};
