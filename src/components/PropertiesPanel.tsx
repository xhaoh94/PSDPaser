import React from 'react';
import { Descriptions, Tag, Empty, Divider, Space } from 'antd';
import {
  FontSizeOutlined,
  PictureOutlined,
  BgColorsOutlined,
  ColumnWidthOutlined,
} from '@ant-design/icons';
import { useSelectionStore } from '../stores';
import { getLayerSize } from '../types/psd';
import { CopyableValue, CopyableColor } from './CopyableValue';
import type { PsdLayer } from '../types/psd';

/**
 * 文本图层属性
 */
const TextProperties: React.FC<{ layer: PsdLayer }> = ({ layer }) => {
  const { textInfo } = layer;
  if (!textInfo) return null;

  return (
    <>
      <Divider plain className="!text-text-muted !border-border !my-4 !text-xs font-medium">
        <Space>
          <FontSizeOutlined />
          <span>文本属性</span>
        </Space>
      </Divider>

      <Descriptions column={1} size="small" styles={{ label: { width: 80, color: '#a1a1aa' } }}>
        <Descriptions.Item label="文本内容">
          <CopyableValue value={textInfo.text} ellipsis maxWidth={150} mono={false} />
        </Descriptions.Item>
        <Descriptions.Item label="字体">
          <CopyableValue value={textInfo.fontFamily} />
        </Descriptions.Item>
        <Descriptions.Item label="字号">
          <CopyableValue value={`${textInfo.fontSize}px`} />
        </Descriptions.Item>
        <Descriptions.Item label="颜色">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border border-gray-300 shadow-sm" style={{ backgroundColor: textInfo.color }}></div>
            <CopyableColor color={textInfo.color} />
          </div>
        </Descriptions.Item>
        {textInfo.strokeColor && (
          <Descriptions.Item label="描边色">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm border border-gray-300 shadow-sm" style={{ backgroundColor: textInfo.strokeColor }}></div>
              <CopyableColor color={textInfo.strokeColor} />
            </div>
          </Descriptions.Item>
        )}
        {textInfo.lineHeight && (
          <Descriptions.Item label="行高">
            <CopyableValue value={`${textInfo.lineHeight}px`} />
          </Descriptions.Item>
        )}
        {textInfo.letterSpacing && (
          <Descriptions.Item label="字间距">
            <CopyableValue value={`${textInfo.letterSpacing}`} />
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
      <Divider plain className="!text-text-muted !border-border !my-4 !text-xs font-medium">
        <Space>
          <PictureOutlined />
          <span>图片属性</span>
        </Space>
      </Divider>

      <Descriptions column={1} size="small" styles={{ label: { width: 80, color: '#a1a1aa' } }}>
        <Descriptions.Item label="资源名称">
          <CopyableValue value={imageInfo.name} ellipsis maxWidth={150} />
        </Descriptions.Item>
        {imageInfo.linkedFileName && (
          <Descriptions.Item label="链接文件">
            <CopyableValue value={imageInfo.linkedFileName} ellipsis maxWidth={150} />
          </Descriptions.Item>
        )}
        {imageInfo.originalWidth && imageInfo.originalHeight && (
          <Descriptions.Item label="原始尺寸">
            <CopyableValue value={`${imageInfo.originalWidth} x ${imageInfo.originalHeight}`} />
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
      <Divider plain className="!text-text-muted !border-border !my-4 !text-xs font-medium">
        <Space>
          <BgColorsOutlined />
          <span>效果</span>
        </Space>
      </Divider>

      <div className="space-y-2">
        {effects.dropShadow?.map((shadow, i) => (
          <div key={`drop-${i}`} className="flex items-center gap-2">
            <Tag color="blue">投影</Tag>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm border border-gray-300 shadow-sm" style={{ backgroundColor: shadow.color }}></div>
              <CopyableColor color={shadow.color} />
            </div>
          </div>
        ))}
        {effects.innerShadow?.map((shadow, i) => (
          <div key={`inner-${i}`} className="flex items-center gap-2">
            <Tag color="purple">内阴影</Tag>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm border border-gray-300 shadow-sm" style={{ backgroundColor: shadow.color }}></div>
              <CopyableColor color={shadow.color} />
            </div>
          </div>
        ))}
        {effects.stroke?.map((stroke, i) => (
          <div key={`stroke-${i}`} className="flex items-center gap-2">
            <Tag color="green">描边</Tag>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm border border-gray-300 shadow-sm" style={{ backgroundColor: stroke.color }}></div>
              <CopyableColor color={stroke.color} />
            </div>
            <CopyableValue value={`${stroke.width}px`} />
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
        <div className="flex-1 flex items-center justify-center p-4 text-center">
          <Empty
            description={<span className="text-text-muted text-xs">点击图层查看属性</span>}
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
      <div className="p-4 space-y-4 overflow-auto text-text-main">
        {/* 基础信息 */}
        <Descriptions column={1} size="small" styles={{ label: { width: 80, color: '#a1a1aa' }, content: { color: '#e4e4e7' } }}>
          <Descriptions.Item label="图层名称">
            <CopyableValue value={selectedLayer.name} ellipsis maxWidth={150} mono={false} />
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
            <CopyableValue value={`${Math.round(selectedLayer.opacity * 100)}%`} />
          </Descriptions.Item>
          {selectedLayer.blendMode && (
            <Descriptions.Item label="混合模式">
              <Tag>{selectedLayer.blendMode}</Tag>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* 尺寸和位置 */}
        <Divider plain className="!text-text-muted !border-border !my-4 !text-xs font-medium">
          <Space>
            <ColumnWidthOutlined />
            <span>尺寸位置</span>
          </Space>
        </Divider>

        <Descriptions column={2} size="small" styles={{ label: { color: '#a1a1aa' }, content: { color: '#e4e4e7' } }}>
          <Descriptions.Item label="宽度">
            <CopyableValue value={`${size.width}px`} />
          </Descriptions.Item>
          <Descriptions.Item label="高度">
            <CopyableValue value={`${size.height}px`} />
          </Descriptions.Item>
          <Descriptions.Item label="X">
            <CopyableValue value={`${bounds.left}px`} />
          </Descriptions.Item>
          <Descriptions.Item label="Y">
            <CopyableValue value={`${bounds.top}px`} />
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
