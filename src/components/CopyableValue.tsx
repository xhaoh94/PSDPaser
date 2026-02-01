import React, { useState } from 'react';
import { Typography, Tooltip, message } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface CopyableValueProps {
  value: string;
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
  mono = true,
  ellipsis = false,
  maxWidth = 150,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
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
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-600 rounded cursor-pointer border-none bg-transparent"
        >
          {copied ? (
            <CheckOutlined className="text-green-400 text-xs" />
          ) : (
            <CopyOutlined className="text-gray-400 hover:text-white text-xs" />
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
      <div
        className="w-5 h-5 rounded border border-gray-600"
        style={{ backgroundColor: color }}
      />
      <Text className="font-mono text-sm">{color}</Text>
      <Tooltip title={copied ? '已复制' : '点击复制'}>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-600 rounded cursor-pointer border-none bg-transparent"
        >
          {copied ? (
            <CheckOutlined className="text-green-400 text-xs" />
          ) : (
            <CopyOutlined className="text-gray-400 hover:text-white text-xs" />
          )}
        </button>
      </Tooltip>
    </span>
  );
};
