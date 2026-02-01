import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import './App.css';

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">PSD 文件解析器</h1>
          <p className="text-gray-400">正在初始化...</p>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default App;
