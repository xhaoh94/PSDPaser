import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, message, Divider, Tag } from 'antd';
import { FolderOpenOutlined, PlusOutlined } from '@ant-design/icons';
import { useConfigStore } from '../stores/configStore';

interface UguiExportModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (prefabName: string) => void;
  defaultPrefabName?: string;
}

export const UguiExportModal: React.FC<UguiExportModalProps> = ({
  open,
  onClose,
  onExport,
  defaultPrefabName = '',
}) => {
  const { 
    uguiSpriteDirHandle, 
    uguiOutputDirHandle, 
    setUguiSpriteDirectory, 
    setUguiOutputDirectory,
    uguiCommonPaths,
    uguiBigFileDirHandle,
    addUguiCommonPath,
    removeUguiCommonPath,
    setUguiBigFileDirectory,
    uguiFontDirHandle,
    setUguiFontDirectory
  } = useConfigStore();
  
  const [prefabName, setPrefabName] = useState(defaultPrefabName);
  
  // 当 modal 打开时，更新默认名称
  useEffect(() => {
    if (open) {
      setPrefabName(defaultPrefabName);
    }
  }, [open, defaultPrefabName]);

  const handleSelectSpriteDir = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setUguiSpriteDirectory(handle);
    } catch (e) {
      // Ignore abort
    }
  };

  const handleSelectOutputDir = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setUguiOutputDirectory(handle);
    } catch (e) {
      // Ignore abort
    }
  };

  const handleAddCommonPath = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      addUguiCommonPath(handle);
    } catch (e) {
      // Ignore abort
    }
  };

  const handleSelectBigFileDir = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setUguiBigFileDirectory(handle);
    } catch (e) {
      // Ignore abort
    }
  };

  const handleSelectFontDir = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker();
      setUguiFontDirectory(handle);
    } catch (e) {
      // Ignore abort
    }
  };

  const verifyPermission = async (handle: FileSystemDirectoryHandle, readWrite: boolean = false) => {
    const options = {
      mode: readWrite ? 'readwrite' : 'read'
    };
    // @ts-ignore
    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }
    // @ts-ignore
    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }
    return false;
  };

  const handleOk = async () => {
    if (!uguiSpriteDirHandle || !uguiOutputDirHandle) {
      message.error('请先选择所有目录');
      return;
    }

    // Verify Permissions
    const spritePerm = await verifyPermission(uguiSpriteDirHandle, true);
    if (!spritePerm) {
      message.error('需要 Sprite 目录的读写权限');
      return;
    }
    
    const outputPerm = await verifyPermission(uguiOutputDirHandle, true);
    if (!outputPerm) {
      message.error('需要输出目录的读写权限');
      return;
    }
    
    if (!prefabName.trim()) {
      message.error('请输入 Prefab 名称');
      return;
    }

    onExport(prefabName.trim());
  };

  return (
    <Modal
      title="导出 UGUI"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="导出 Prefab"
      cancelText="取消"
      okButtonProps={{ disabled: !uguiSpriteDirHandle || !uguiOutputDirHandle }}
    >
      <div className="flex flex-col gap-4 py-4">
        {/* Prefab Name */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Prefab 名称</label>
          <Input 
            value={prefabName} 
            onChange={(e) => setPrefabName(e.target.value)}
            placeholder="输入 Prefab 文件名（不含扩展名）"
            className="flex-1"
          />
        </div>

        {/* Sprite Directory */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Sprite 资源目录 (读取 .meta)</label>
          <div className="flex gap-2">
            <Input 
              readOnly 
              value={uguiSpriteDirHandle ? uguiSpriteDirHandle.name : ''} 
              placeholder="未选择" 
              className="flex-1"
            />
            <Button icon={<FolderOpenOutlined />} onClick={handleSelectSpriteDir}>
              选择
            </Button>
          </div>
        </div>

        {/* Output Directory */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Prefab 输出目录</label>
          <div className="flex gap-2">
            <Input 
              readOnly 
              value={uguiOutputDirHandle ? uguiOutputDirHandle.name : ''} 
              placeholder="未选择" 
              className="flex-1"
            />
            <Button icon={<FolderOpenOutlined />} onClick={handleSelectOutputDir}>
              选择
            </Button>
          </div>
        </div>

        <Divider>高级配置</Divider>

        {/* BigFile Directory */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">BigFile 目录 (大图导出，512px以上)</label>
          <div className="flex gap-2">
            <Input 
              readOnly 
              value={uguiBigFileDirHandle ? uguiBigFileDirHandle.name : ''} 
              placeholder="未选择（可选）" 
              className="flex-1"
            />
            <Button icon={<FolderOpenOutlined />} onClick={handleSelectBigFileDir}>
              选择
            </Button>
          </div>
        </div>

        {/* Font Directory */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">字体目录 (自动匹配字体)</label>
          <div className="flex gap-2">
            <Input 
              readOnly 
              value={uguiFontDirHandle ? uguiFontDirHandle.name : ''} 
              placeholder="未选择（可选）" 
              className="flex-1"
            />
            <Button icon={<FolderOpenOutlined />} onClick={handleSelectFontDir}>
              选择
            </Button>
          </div>
        </div>

        {/* Common Paths */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">公共 Sprite 路径</label>
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
            {uguiCommonPaths.length === 0 && (
              <span className="text-gray-400 text-sm">未配置公共路径</span>
            )}
            {uguiCommonPaths.map((handle, index) => (
              <Tag 
                key={index} 
                closable 
                onClose={() => removeUguiCommonPath(index)}
                className="flex items-center gap-1"
              >
                {handle.name}
              </Tag>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
