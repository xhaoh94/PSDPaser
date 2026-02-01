import React from 'react';
import { Typography, Descriptions, Tag, Empty, Divider, Space, Tooltip } from 'antd';
import {
  FontSizeOutlined,
  PictureOutlined,
  BgColorsOutlined,
  ColumnWidthOutlined,
  ColumnHeightOutlined,
} from '@ant-design/icons';
import { useSelectionStore } from '../stores';
import { getLayerSize } from '../types/psd';
import type { PsdLayer } from '../types/psd';

const { Text, Title } = Typography;

/**
 * 颜色显示组件
 */
const ColorDisplay: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <div
      className="w-5 h-5 rounded border border-gray-600"
      style={{ backgroundColor: color }}
    />
    <Text className="font-mono text-sm">{color}</Text>
  </div>
);

/**
 * 文本图层属性
 */
const TextProperties: React.FC<{ layer: PsdLayer }> = ({ layer }) => {
  const { textInfo } = layer;
  if (!textInfo) return null;

  return (
    <>
      <Divider orientation="left" plain>
        <Space>
          <FontSizeOutlined />
          <span>文本属性</span>
        </Space>
      </Divider>

      <Descriptions column={1} size="small" labelStyle={{ width: 80 }}>
        <Descriptions.Item label="文本内容">
          <Tooltip title={textInfo.text}>
            <Text ellipsis style={{ maxWidth: 150 }}>
              {textInfo.text}
            </Text>
          </Tooltip>
        </Descriptions.Item>
        <Descriptions.Item label="字体">
          <Text className="font-mono text-sm">{textInfo.fontFamily}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="字号">
          <Text className="font-mono text-sm">{textInfo.fontSize}px</Text>
        </Descriptions.Item>
        <Descriptions.Item label="颜色">
          <ColorDisplay color={textInfo.color} label="填充色" />
        </Descriptions.Item>
        {textInfo.strokeColor && (
          <Descriptions.Item label="描边色">
            <ColorDisplay color={textInfo.strokeColor} label="描边色" />
          </Descriptions.Item>
        )}
        {textInfo.lineHeight && (
          <Descriptions.Item label="行高">
            <Text className="font-mono text-sm">{textInfo.lineHeight}px</Text>
          </Descriptions.Item>
        )}
        {textInfo.letterSpacing && (
          <Descriptions.Item label="字间距">
            <Text className="font-mono text-sm">{textInfo.letterSpacing}</Text>
          </Descriptions.Item>
        )}
        {textInfo.textAlign && (
          <Descriptions.Item label="对齐">
            <Tag>{textInfo.textAlign}</Tag>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="样式">
          <Space>
            {textInfo.bold && <Tag color="blue">粗体</Tag>}
            {textInfo.italic && <Tag color="purple">斜体</Tag>}
            {textInfo.underline && <Tag color="cyan">下划线</Tag>}
          </Space>
        </Descriptions.Item>
      </Descriptions>
    </>
  );
};

/**
 * 图片/智能对象属性
 */
const ImageProperties: React.FC<{ layer: PsdLayer }> = ({ layer }) => {
  const { imageInfo } = layer;
  if (!imageInfo) return null;

  return (
    <>
      <Divider orientation="left" plain>
        <Space>
          <PictureOutlined />
          <span>图片属性</span>
        </Space>
      </Divider>

      <Descriptions column={1} size="small" labelStyle={{ width: 80 }}>
        <Descriptions.Item label="资源名称">
          <Text className="font-mono text-sm">{imageInfo.name}</Text>
        </Descriptions.Item>
        {imageInfo.linkedFileName && (
          <Descriptions.Item label="链接文件">
            <Text className="font-mono text-sm">{imageInfo.linkedFileName}</Text>
          </Descriptions.Item>
        )}
        {imageInfo.originalWidth && imageInfo.originalHeight && (
          <Descriptions.Item label="原始尺寸">
            <Text className="font-mono text-sm">
              {imageInfo.originalWidth} x {imageInfo.originalHeight}
            </Text>
          </Descriptions.Item>
        )}
      </Descriptions>
    </>
  );
};

/**
 * 效果属性
 */
const EffectsProperties: React.FC<{ layer: PsdLayer }> = ({ layer }) => {
  const { effects } = layer;
  if (!effects) return null;

  const hasEffects = effects.dropShadow?.length || effects.stroke?.length || effects.innerShadow?.length;
  if (!hasEffects) return null;

  return (
    <>
      <Divider orientation="left" plain>
        <Space>
          <BgColorsOutlined />
          <span>效果</span>
        </Space>
      </Divider>

      <div className="space-y-2">
        {effects.dropShadow?.map((shadow, i) => (
          <div key={`drop-${i}`} className="flex items-center gap-2">
            <Tag color="blue">投影</Tag>
            <ColorDisplay color={shadow.color} label="阴影色" />
          </div>
        ))}
        {effects.innerShadow?.map((shadow, i) => (
          <div key={`inner-${i}`} className="flex items-center gap-2">
            <Tag color="purple">内阴影</Tag>
            <ColorDisplay color={shadow.color} label="阴影色" />
          </div>
        ))}
        {effects.stroke?.map((stroke, i) => (
          <div key={`stroke-${i}`} className="flex items-center gap-2">
            <Tag color="green">描边</Tag>
            <ColorDisplay color={stroke.color} label="描边色" />
            <Text className="text-xs text-gray-400">{stroke.width}px</Text>
          </div>
        ))}
      </div>
    </>
  );
};

/**
 * 属性面板组件
 */
export const PropertiesPanel: React.FC = () => {
  const { selectedLayer } = useSelectionStore();

  if (!selectedLayer) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <Title level={5} className="!mb-0">属性</Title>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Empty
            description="选择图层查看属性"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      </div>
    );
  }

  const size = getLayerSize(selectedLayer.bounds);
  const { bounds } = selectedLayer;

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* 标题 */}
      <div className="p-4 border-b border-gray-700">
        <Title level={5} className="!mb-0">属性</Title>
      </div>

      <div className="p-4 space-y-4 overflow-auto">
        {/* 基础信息 */}
        <Descriptions column={1} size="small" labelStyle={{ width: 80 }}>
          <Descriptions.Item label="图层名称">
            <Tooltip title={selectedLayer.name}>
              <Text strong ellipsis style={{ maxWidth: 150 }}>
                {selectedLayer.name}
              </Text>
            </Tooltip>
          </Descriptions.Item>
          <Descriptions.Item label="类型">
            <Tag color="blue">{selectedLayer.type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="可见性">
            <Tag color={selectedLayer.visible ? 'green' : 'default'}>
              {selectedLayer.visible ? '可见' : '隐藏'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="透明度">
            <Text className="font-mono text-sm">
              {Math.round(selectedLayer.opacity * 100)}%
            </Text>
          </Descriptions.Item>
          {selectedLayer.blendMode && (
            <Descriptions.Item label="混合模式">
              <Tag>{selectedLayer.blendMode}</Tag>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* 尺寸和位置 */}
        <Divider orientation="left" plain>
          <Space>
            <ColumnWidthOutlined />
            <span>尺寸位置</span>
          </Space>
        </Divider>

        <Descriptions column={2} size="small">
          <Descriptions.Item label="宽度">
            <Text className="font-mono text-sm">{size.width}px</Text>
          </Descriptions.Item>
          <Descriptions.Item label="高度">
            <Text className="font-mono text-sm">{size.height}px</Text>
          </Descriptions.Item>
          <Descriptions.Item label="X">
            <Text className="font-mono text-sm">{bounds.left}px</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Y">
            <Text className="font-mono text-sm">{bounds.top}px</Text>
          </Descriptions.Item>
        </Descriptions>

        {/* 类型特定属性 */}
        {selectedLayer.type === 'text' && <TextProperties layer={selectedLayer} />}
        {selectedLayer.type === 'image' && <ImageProperties layer={selectedLayer} />}

        {/* 效果 */}
        <EffectsProperties layer={selectedLayer} />
      </div>
    </div>
  );
};
