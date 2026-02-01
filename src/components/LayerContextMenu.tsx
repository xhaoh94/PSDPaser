import React from 'react';
import { Dropdown } from 'antd';
import {
  FontSizeOutlined,
  PictureOutlined,
  FolderOutlined,
  StarOutlined,
  ControlOutlined,
} from '@ant-design/icons';
import type { PsdLayer, LayerType } from '../types/psd';

interface LayerContextMenuProps {
  layers: PsdLayer[];
  onSelect: (layer: PsdLayer) => void;
  children: React.ReactNode;
  visible: boolean;
  position: { x: number; y: number };
  onVisibleChange: (visible: boolean) => void;
}

/**
 * 获取图层类型图标
 */
const getLayerIcon = (type: LayerType): React.ReactNode => {
  switch (type) {
    case 'text':
      return <FontSizeOutlined className="text-blue-400" />;
    case 'image':
      return <PictureOutlined className="text-green-400" />;
    case 'group':
      return <FolderOutlined className="text-yellow-400" />;
    case 'shape':
      return <StarOutlined className="text-purple-400" />;
    case 'adjustment':
      return <ControlOutlined className="text-orange-400" />;
    default:
      return <PictureOutlined className="text-gray-400" />;
  }
};

/**
 * 图层右键菜单组件
 * 用于选择重叠的图层
 */
export const LayerContextMenu: React.FC<LayerContextMenuProps> = ({
  layers,
  onSelect,
  children,
  visible,
  position,
  onVisibleChange,
}) => {
  const menuItems = layers.map((layer, index) => ({
    key: layer.id,
    icon: getLayerIcon(layer.type),
    label: (
      <span className="text-sm">
        {layer.name}
        {index === 0 && (
          <span className="ml-2 text-xs text-gray-400">(最顶层)</span>
        )}
      </span>
    ),
    onClick: () => {
      onSelect(layer);
      onVisibleChange(false);
    },
  }));

  if (layers.length === 0) {
    menuItems.push({
      key: 'empty',
      icon: null,
      label: <span className="text-gray-400">此处无图层</span>,
      onClick: () => onVisibleChange(false),
    });
  }

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['contextMenu']}
      open={visible}
      onOpenChange={onVisibleChange}
      dropdownRender={(menu) => (
        <div style={{ position: 'fixed', left: position.x, top: position.y }}>
          {menu}
        </div>
      )}
    >
      {children}
    </Dropdown>
  );
};
