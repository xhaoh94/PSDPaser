import React, { useMemo } from 'react';
import { Tree, Typography, Tooltip, Empty } from 'antd';
import {
  FontSizeOutlined,
  PictureOutlined,
  FolderOutlined,
  StarOutlined,
  ControlOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { usePsdStore, useSelectionStore } from '../stores';
import type { PsdLayer, LayerType } from '../types/psd';

const { Text } = Typography;

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
 * 将 PsdLayer 转换为 Ant Design Tree 数据结构
 */
const convertLayersToTreeData = (
  layers: PsdLayer[],
  onSelect: (layer: PsdLayer) => void
): DataNode[] => {
  return layers.map((layer) => ({
    key: layer.id,
    title: (
      <div className="flex items-center gap-2 py-1">
        {/* 可见性图标 */}
        {layer.visible ? (
          <EyeOutlined className="text-gray-400 text-xs" />
        ) : (
          <EyeInvisibleOutlined className="text-gray-600 text-xs" />
        )}
        {/* 类型图标 */}
        {getLayerIcon(layer.type)}
        {/* 图层名称 */}
        <Tooltip title={layer.name} mouseEnterDelay={0.5}>
          <Text
            className={`text-sm ${layer.visible ? '' : 'opacity-50'}`}
            ellipsis
            style={{ maxWidth: 150 }}
          >
            {layer.name}
          </Text>
        </Tooltip>
      </div>
    ),
    children: layer.children
      ? convertLayersToTreeData(layer.children, onSelect)
      : undefined,
    isLeaf: !layer.children || layer.children.length === 0,
    layer, // 保存原始图层数据
  }));
};

/**
 * 图层树面板组件
 */
export const LayerTree: React.FC = () => {
  const { document } = usePsdStore();
  const { selectedLayerId, selectLayer } = useSelectionStore();
  const { getAllLayers, getLayerById } = usePsdStore();

  // 转换图层数据
  const treeData = useMemo(() => {
    if (!document) return [];
    return convertLayersToTreeData(document.layers, (layer) => selectLayer(layer));
  }, [document, selectLayer]);

  // 处理选择
  const handleSelect = (
    selectedKeys: React.Key[],
    info: { node: DataNode }
  ) => {
    if (selectedKeys.length > 0) {
      const layerId = selectedKeys[0] as string;
      const layer = getLayerById(layerId);
      if (layer) {
        selectLayer(layer);
      }
    } else {
      selectLayer(null);
    }
  };

  // 计算展开的键（默认展开所有组）
  const expandedKeys = useMemo(() => {
    const keys: string[] = [];
    const collectGroupKeys = (layers: PsdLayer[]) => {
      for (const layer of layers) {
        if (layer.type === 'group' && layer.children) {
          keys.push(layer.id);
          collectGroupKeys(layer.children);
        }
      }
    };
    if (document) {
      collectGroupKeys(document.layers);
    }
    return keys;
  }, [document]);

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Empty
          description="请先加载 PSD 文件"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  const totalLayers = getAllLayers().length;

  return (
    <div className="h-full flex flex-col">
      {/* 标题 */}
      <div className="p-4 border-b border-gray-700">
        <Text strong className="text-base">图层</Text>
        <Text type="secondary" className="ml-2 text-xs">
          ({totalLayers})
        </Text>
      </div>

      {/* 图层树 */}
      <div className="flex-1 overflow-auto p-2">
        <Tree
          treeData={treeData}
          selectedKeys={selectedLayerId ? [selectedLayerId] : []}
          defaultExpandedKeys={expandedKeys}
          onSelect={handleSelect}
          showLine={{ showLeafIcon: false }}
          blockNode
          virtual
          height={400}
        />
      </div>
    </div>
  );
};
