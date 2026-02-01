import React from 'react';
import { Button, Tooltip } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useUiStore } from '../stores';

/**
 * 主题切换按钮组件
 */
export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useUiStore();

  const isDark = theme === 'dark';

  return (
    <Tooltip title={isDark ? '切换到浅色模式' : '切换到深色模式'}>
      <Button
        type="text"
        icon={isDark ? <SunOutlined /> : <MoonOutlined />}
        onClick={toggleTheme}
        className="text-lg"
      />
    </Tooltip>
  );
};
