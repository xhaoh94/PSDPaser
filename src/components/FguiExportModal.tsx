import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';

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

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        packageName: defaultPackageName,
        viewName: defaultViewName,
      });
    }
  }, [open, defaultPackageName, defaultViewName, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      onExport(values.packageName, values.viewName);
    });
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
      </Form>
    </Modal>
  );
};
