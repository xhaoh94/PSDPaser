/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter', 
          '-apple-system', 
          'BlinkMacSystemFont', 
          'PingFang SC', // 中文优化
          'Microsoft YaHei',
          'sans-serif'
        ],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '12px' }],
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['13px', { lineHeight: '20px' }],
        'base': ['14px', { lineHeight: '22px' }],
      },
      colors: {
        // 蓝湖/Figma 风格亮色系
        bg: {
          app: '#f5f5f5',      // 画布背景 (浅灰)
          panel: '#ffffff',    // 面板背景 (纯白)
          header: '#ffffff',   // 顶部背景
          hover: '#f0f2f5',    // 列表悬停
          active: '#e6f7ff',   // 列表选中 (浅蓝)
          input: '#f5f5f5',    // 输入框背景
        },
        border: {
          DEFAULT: '#e8e8e8',  // 默认边框
          dark: '#d9d9d9',     // 深色边框
        },
        text: {
          main: '#333333',     // 主文字
          secondary: '#666666',// 次要文字
          dim: '#999999',      // 辅助文字
        },
        accent: {
          primary: '#1890ff',  // 蓝湖蓝
          hover: '#40a9ff',
          red: '#f5222d',      // 标注红
        }
      },
      boxShadow: {
        'panel': '0 2px 8px rgba(0, 0, 0, 0.05)',
        'float': '0 4px 12px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
}