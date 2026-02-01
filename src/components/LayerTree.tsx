import React, { useMemo } from 'react';
import { Tree, Tooltip, Empty } from 'antd';
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

/**
 * 获取图层类型图标
 */
const getLayerIcon = (type: LayerType): React.ReactNode => {
  switch (type) {
    case 'text':
      return <FontSizeOutlined className="text-blue-500" />;
    case 'image':
      return <PictureOutlined className="text-green-500" />;
    case 'group':
      return <FolderOutlined className="text-yellow-500" />;
    case 'shape':
      return <StarOutlined className="text-purple-500" />;
    case 'adjustment':
      return <ControlOutlined className="text-orange-500" />;
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
      <div className="flex items-center gap-2 py-0.5">
        {/* 可见性图标 */}
        <div className="w-4 flex justify-center group">
          {layer.visible ? (
            <EyeOutlined className="text-gray-400 text-[10px] group-hover:text-gray-600" />
          ) : (
            <EyeInvisibleOutlined className="text-gray-300 text-[10px]" />
          )}
        </div>
        {/* 类型图标 */}
        <div className="w-4 flex justify-center">
          {getLayerIcon(layer.type)}
        </div>
        {/* 图层名称 */}
        <Tooltip title={layer.name} mouseEnterDelay={0.8}>
          <span
            className={`text-xs truncate ${layer.visible ? 'text-gray-700' : 'text-gray-400'}`}
            style={{ maxWidth: 140 }}
          >
            {layer.name}
          </span>
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
  
  const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>([]);

  // 转换图层数据
  const treeData = useMemo(() => {
    if (!document) return [];
    return convertLayersToTreeData(document.layers, (layer) => selectLayer(layer));
  }, [document, selectLayer]);

  // 处理选择
  const handleSelect = (
    selectedKeys: React.Key[],
    _info: { node: DataNode }
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

  // 辅助函数：查找图层的父级路径
  const findParentKeys = (layers: PsdLayer[], targetId: string, parents: string[] = []): string[] | null => {
    for (const layer of layers) {
      if (layer.id === targetId) {
        return parents;
      }
      if (layer.children) {
        const result = findParentKeys(layer.children, targetId, [...parents, layer.id]);
        if (result) return result;
      }
    }
    return null;
  };

  // 当文档加载时，默认展开所有组
  React.useEffect(() => {
    if (document) {
      const keys: string[] = [];
      const collectGroupKeys = (layers: PsdLayer[]) => {
        for (const layer of layers) {
          if (layer.type === 'group' && layer.children) {
            keys.push(layer.id);
            collectGroupKeys(layer.children);
          }
        }
      };
      collectGroupKeys(document.layers);
      setExpandedKeys(keys);
    }
  }, [document]);

  // 当选中图层变化时，自动展开父组
  React.useEffect(() => {
    if (document && selectedLayerId) {
      const parentKeys = findParentKeys(document.layers, selectedLayerId);
      if (parentKeys && parentKeys.length > 0) {
        setExpandedKeys(prev => {
          const newKeys = new Set([...prev, ...parentKeys]);
          return Array.from(newKeys);
        });
      }
    }
  }, [document, selectedLayerId]);

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Empty
          description={<span className="text-gray-400 text-xs">请先加载文件</span>}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  const totalLayers = getAllLayers().length;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 图层树 */}
      <div className="flex-1 overflow-auto py-1">
        <Tree
          className="file-tree"
          treeData={treeData}
          selectedKeys={selectedLayerId ? [selectedLayerId] : []}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys)}
          onSelect={handleSelect}
          showLine={{ showLeafIcon: false }}
          blockNode
          virtual
        />
      </div>
      
      {/* 底部统计 */}
      <div className="px-4 py-2 border-t border-gray-100 text-center">
        <span className="text-[10px] text-gray-400">
          共 {totalLayers} 个图层
        </span>
      </div>
    </div>
  );
};
