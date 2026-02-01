import React from 'react';
import { List, Button, Typography, Space, Empty, Spin, Alert } from 'antd';
import { FolderOpenOutlined, FileOutlined, FileImageOutlined } from '@ant-design/icons';
import { useFileSystem } from '../hooks/useFileSystem';
import type { PsdFile } from '../hooks/useFileSystem';

const { Text } = Typography;

interface FileListProps {
  onFileSelect?: (file: PsdFile) => void;
  selectedFile?: PsdFile | null;
}

/**
 * 文件列表组件
 * 显示目录中的 PSD 文件，支持选择
 */
export const FileList: React.FC<FileListProps> = ({ onFileSelect, selectedFile }) => {
  const {
    files,
    isLoading,
    error,
    selectDirectory,
    selectFile,
    supportsDirectoryPicker,
  } = useFileSystem();

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 处理文件点击
  const handleFileClick = (file: PsdFile) => {
    onFileSelect?.(file);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 操作按钮 */}
      <div className="p-4 border-b border-gray-700">
        <Space direction="vertical" className="w-full" size="small">
          {supportsDirectoryPicker && (
            <Button
              type="primary"
              icon={<FolderOpenOutlined />}
              onClick={selectDirectory}
              loading={isLoading}
              block
            >
              选择目录
            </Button>
          )}
          <Button
            icon={<FileOutlined />}
            onClick={selectFile}
            loading={isLoading}
            block
          >
            选择文件
          </Button>
        </Space>
        {!supportsDirectoryPicker && (
          <Text type="secondary" className="text-xs mt-2 block">
            当前浏览器不支持目录选择，请使用 Chrome/Edge
          </Text>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert
          message={error}
          type="warning"
          showIcon
          className="m-4"
        />
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Spin tip="加载中..." />
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && files.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <Empty
            description="请选择包含 PSD 文件的目录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      )}

      {/* 文件列表 */}
      {!isLoading && files.length > 0 && (
        <div className="flex-1 overflow-auto">
          <List
            size="small"
            dataSource={files}
            renderItem={(file) => (
              <List.Item
                className={`cursor-pointer hover:bg-gray-700 transition-colors px-4 ${
                  selectedFile?.name === file.name ? 'bg-blue-900/50' : ''
                }`}
                onClick={() => handleFileClick(file)}
              >
                <List.Item.Meta
                  avatar={<FileImageOutlined className="text-blue-400 text-lg" />}
                  title={
                    <Text
                      className="text-sm"
                      ellipsis={{ tooltip: file.name }}
                    >
                      {file.name}
                    </Text>
                  }
                  description={
                    <Text type="secondary" className="text-xs">
                      {formatFileSize(file.size)}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}

      {/* 文件数量统计 */}
      {files.length > 0 && (
        <div className="p-2 border-t border-gray-700 text-center">
          <Text type="secondary" className="text-xs">
            共 {files.length} 个 PSD 文件
          </Text>
        </div>
      )}
    </div>
  );
};
