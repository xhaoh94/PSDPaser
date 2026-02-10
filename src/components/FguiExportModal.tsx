import React, { useEffect } from 'react';
import { Modal, Form, Input, Divider, Button, Tag, message } from 'antd';
import { FolderOpenOutlined, PlusOutlined } from '@ant-design/icons';
import { useConfigStore } from '../stores/configStore';

interface FguiExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (packageName: string, viewName: string) => void;
  defaultPackageName?: string;
  defaultViewName?: string;
}

export const FguiExportModal: React.FC<FguiExportModalProps> = ({
  open,
  onClose,
  onExport,
  defaultPackageName = '',
  defaultViewName = '',
}) => {
  const [form] = Form.useForm();
  const { 
    fguiDirHandle,
    setFguiDirectory,
    fguiCommonPaths,
    fguiBigFileDirHandle,
    addFguiCommonPath,
    removeFguiCommonPath,
    setFguiBigFileDirectory
  } = useConfigStore();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        packageName: defaultPackageName,
        viewName: defaultViewName,
      });
    }
  }, [open, defaultPackageName, defaultViewName, form]);

  const handleOk = () => {
    if (!fguiDirHandle) {
        message.error('请先选择 FGUI 项目目录');
        return;
    }
    form.validateFields().then((values) => {
      onExport(values.packageName, values.viewName);
    });
  };

  const handleSelectFguiDir = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setFguiDirectory(handle);
    } catch (e) {
      // Ignore abort
    }
  };

  const handleAddCommonPath = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      addFguiCommonPath(handle);
    } catch (e) {
      // Ignore abort
    }
  };

  const handleSelectBigFileDir = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setFguiBigFileDirectory(handle);
    } catch (e) {
      // Ignore abort
    }
  };

  return (
    <Modal
      title="导出 FGUI"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="确认导出"
      cancelText="取消"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          packageName: defaultPackageName,
          viewName: defaultViewName,
        }}
      >
        <Form.Item label="FGUI 项目目录">
          <div className="flex gap-2">
            <Input 
              readOnly 
              value={fguiDirHandle ? fguiDirHandle.name : ''} 
              placeholder="请选择 FGUI 工程根目录" 
              className="flex-1"
            />
            <Button icon={<FolderOpenOutlined />} onClick={handleSelectFguiDir}>
              选择
            </Button>
          </div>
        </Form.Item>

        <Form.Item
          name="packageName"
          label="包名 (Package Name)"
          rules={[{ required: true, message: '请输入包名' }]}
        >
          <Input placeholder="例如: Main" />
        </Form.Item>
        <Form.Item
          name="viewName"
          label="界面名 (View Name)"
          rules={[{ required: true, message: '请输入界面名' }]}
        >
          <Input placeholder="例如: LoginView" />
        </Form.Item>

        <Divider>高级配置</Divider>

        {/* BigFile Directory */}
        <div className="flex flex-col gap-1 mb-4">
          <label className="text-sm font-medium text-gray-700">BigFile 目录 (大图导出，512px以上)</label>
          <div className="flex gap-2">
            <Input 
              readOnly 
              value={fguiBigFileDirHandle ? fguiBigFileDirHandle.name : ''} 
              placeholder="未选择（可选，默认 Assets）" 
              className="flex-1"
            />
            <Button icon={<FolderOpenOutlined />} onClick={handleSelectBigFileDir}>
              选择
            </Button>
          </div>
        </div>

        {/* Common Paths */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">公共包资源路径</label>
            <Button 
              type="dashed" 
              size="small" 
              icon={<PlusOutlined />} 
              onClick={handleAddCommonPath}
            >
              添加
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {fguiCommonPaths.length === 0 && (
              <span className="text-gray-400 text-sm">未配置公共路径</span>
            )}
            {fguiCommonPaths.map((handle, index) => (
              <Tag 
                key={index} 
                closable 
                onClose={() => removeFguiCommonPath(index)}
                className="flex items-center gap-1"
              >
                {handle.name}
              </Tag>
            ))}
          </div>
        </div>
      </Form>
    </Modal>
  );
};
