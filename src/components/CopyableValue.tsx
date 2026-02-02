import React, { useState } from 'react';
import { Typography, Tooltip, message } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface CopyableValueProps {
  value: string;
  /** 复制时使用的值（可选，默认使用 value） */
  copyValue?: string;
  mono?: boolean;
  ellipsis?: boolean;
  maxWidth?: number;
}

/**
 * 可复制的值组件
 * 点击复制按钮复制值到剪贴板
 */
export const CopyableValue: React.FC<CopyableValueProps> = ({
  value,
  copyValue,
  mono = true,
  ellipsis = false,
  maxWidth = 150,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // 优先使用 copyValue，否则使用 value
      await navigator.clipboard.writeText(copyValue ?? value);
      setCopied(true);
      message.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败');
    }
  };

  return (
    <span className="inline-flex items-center gap-1 group">
      {ellipsis ? (
        <Tooltip title={value}>
          <Text
            className={mono ? 'font-mono text-sm' : 'text-sm'}
            ellipsis
            style={{ maxWidth }}
          >
            {value}
          </Text>
        </Tooltip>
      ) : (
        <Text className={mono ? 'font-mono text-sm' : 'text-sm'}>
          {value}
        </Text>
      )}
      <Tooltip title={copied ? '已复制' : '点击复制'}>
        <button
          onClick={handleCopy}
          className="p-0.5 hover:bg-gray-100 rounded cursor-pointer border-none bg-transparent transition-colors"
        >
          {copied ? (
            <CheckOutlined className="text-green-500 text-xs" />
          ) : (
            <CopyOutlined className="text-gray-400 hover:text-blue-500 text-xs" />
          )}
        </button>
      </Tooltip>
    </span>
  );
};

/**
 * 颜色可复制组件
 * 显示颜色色块和 HEX 值，可复制
 */
interface CopyableColorProps {
  color: string;
}

export const CopyableColor: React.FC<CopyableColorProps> = ({ color }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(color);
      setCopied(true);
      message.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败');
    }
  };

  return (
    <span className="inline-flex items-center gap-2 group">
      <span
        style={{ 
          backgroundColor: color,
          width: '16px',
          height: '16px',
          borderRadius: '3px',
          border: '1px solid #9ca3af',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      <Text className="font-mono text-sm">{color}</Text>
      <Tooltip title={copied ? '已复制' : '点击复制'}>
        <button
          onClick={handleCopy}
          className="p-0.5 hover:bg-gray-100 rounded cursor-pointer border-none bg-transparent transition-colors"
        >
          {copied ? (
            <CheckOutlined className="text-green-500 text-xs" />
          ) : (
            <CopyOutlined className="text-gray-400 hover:text-blue-500 text-xs" />
          )}
        </button>
      </Tooltip>
    </span>
  );
};
