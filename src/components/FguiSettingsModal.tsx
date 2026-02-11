import React from 'react';
import { Modal, Button, InputNumber, message, Checkbox } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { useConfigStore } from '../stores/configStore';

interface FguiSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const FguiSettingsModal: React.FC<FguiSettingsModalProps> = ({ open, onClose }) => {
  const { 
    fguiProjectName, 
    setFguiDirectory, 
    clearFguiDirectory,
    largeImageThreshold,
    setLargeImageThreshold,
    serverConfig,
    overwriteImages,
    setOverwriteImages
  } = useConfigStore();

  const handleSelectFolder = async () => {
    try {
      // 请求用户选择目录
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        id: 'fgui-project',
        startIn: 'documents'
      });
      
      // 简单验证：检查是否存在 assets 目录
      // 虽然新建项目可能没有，但一般导出目标是已存在的项目
      // 这里不做强校验，直接设置
      setFguiDirectory(handle);
      message.success(`已设置 FGUI 项目目录: ${handle.name}`);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error(err);
        message.error('选择目录失败');
      }
    }
  };

  return (
    <Modal
      title="FGUI 导出配置"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>
      ]}
    >
      <div className="space-y-6">
        <div>
          <h4 className="mb-2 font-medium">项目路径</h4>
          {serverConfig?.fguiProjectDir && (
            <div 
              className="mb-2 p-2 bg-blue-50 border border-blue-100 rounded text-blue-600 text-xs cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(serverConfig.fguiProjectDir!);
                message.success('路径已复制，请在选择框中粘贴');
              }}
              title="点击复制路径"
            >
              提示：项目配置文件建议的路径是 <strong>{serverConfig.fguiProjectDir}</strong> (点击复制)
            </div>
          )}
          <div className="flex gap-2">
            <div className="flex-1 p-2 bg-gray-50 border rounded text-gray-600 text-sm truncate">
              {fguiProjectName || '未配置'}
            </div>
            <Button 
              icon={<FolderOpenOutlined />} 
              onClick={handleSelectFolder}
            >
              选择文件夹
            </Button>
          </div>
          {fguiProjectName && (
            <div className="mt-2 text-right">
              <Button type="link" danger size="small" onClick={clearFguiDirectory}>
                清除配置
              </Button>
            </div>
          )}
        </div>

        <div>
          <h4 className="mb-2 font-medium">大图阈值 (像素)</h4>
          <div className="flex items-center gap-2">
            <span>当图片宽高超过</span>
            <InputNumber 
              value={largeImageThreshold} 
              onChange={(val) => val && setLargeImageThreshold(val)} 
              min={128}
              max={4096}
            />
            <span>px 时，放入 Single 包独立加载。</span>
          </div>
        </div>

        <div>
          <h4 className="mb-2 font-medium">图片导出策略</h4>
          <Checkbox 
            checked={overwriteImages}
            onChange={(e) => setOverwriteImages(e.target.checked)}
          >
            覆盖导出已有图片（不勾选则引用已有图片）
          </Checkbox>
          <p className="text-xs text-gray-500 mt-1">
            开启后，即使目标目录中已存在同名图片，也会用 PSD 中的新内容覆盖。
            关闭时，会保留已有图片并复用其 ID/GUID。
          </p>
        </div>
      </div>
    </Modal>
  );
};
