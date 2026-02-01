import { useEffect, useState } from 'react';
import { ConfigProvider, theme, Layout, Spin, message, Button, Tooltip } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { 
  FolderOpenOutlined, 
  FileOutlined
} from '@ant-design/icons';
import { usePsdStore } from './stores';
import { FileList } from './components/FileList';
import { CanvasViewer } from './components/CanvasViewer';
import { LayerTree } from './components/LayerTree';
import { PropertiesPanel } from './components/PropertiesPanel';
import { parsePsdFromFile, checkFileSizeWarning } from './utils/psdParser';
import { useFileSystem } from './hooks/useFileSystem';
import type { PsdFile } from './hooks/useFileSystem';
import './App.css';

const { Sider, Content } = Layout;

function App() {
  const { setDocument, setLoading, setError, isLoading, document: psdDoc } = usePsdStore();
  const [selectedFile, setSelectedFile] = useState<PsdFile | null>(null);
  
  const { selectDirectory } = useFileSystem();

  // Force Light Mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const handleFileSelect = async (file: PsdFile) => {
    setSelectedFile(file);
    const warning = checkFileSizeWarning(file.size);
    if (warning) message.warning(warning);

    setLoading(true);
    try {
      const doc = await parsePsdFromFile(file.file);
      setDocument(doc, file.name);
      message.success({ content: `已加载 ${file.name}`, key: 'loading' });
    } catch (err) {
      console.error(err);
      const errorMsg = (err as Error).message || '解析失败';
      setError(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const lightToken = {
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBorder: '#e8e8e8',
    colorText: '#333333',
    colorTextSecondary: '#666666',
    colorPrimary: '#1890ff',
    borderRadius: 4,
    fontFamily: 'Inter, sans-serif',
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: lightToken,
        components: {
          Layout: {
            bodyBg: '#f5f5f5',
            siderBg: '#ffffff',
          },
          Button: {
            controlHeight: 32,
          }
        }
      }}
    >
      <Layout className="h-screen overflow-hidden bg-bg-app font-sans text-text-main">
        {/* Left Sidebar - Navigation & Layers */}
        <Sider width={250} className="bg-white border-r border-border flex flex-col z-20 shadow-sm" theme="light">
          <div className="flex flex-col h-full">
            {/* App Title / Logo Area (Minimal) */}
            <div className="h-12 flex items-center px-4 border-b border-border bg-gray-50/50">
              <div className="font-bold text-lg text-gray-800 tracking-tight flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs">P</span>
                PSD 解析器
              </div>
            </div>

            {/* File Navigation */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase">文件目录</span>
                <Tooltip title="打开新目录">
                  <Button type="text" size="small" icon={<FolderOpenOutlined />} onClick={selectDirectory} className="text-blue-600 hover:bg-blue-50" />
                </Tooltip>
              </div>
              <div className="flex-1 overflow-hidden px-2">
                <FileList onFileSelect={handleFileSelect} selectedFile={selectedFile} />
              </div>
            </div>

            {/* Layer Tree (Bottom Half) */}
            {psdDoc && (
              <div className="h-1/2 flex flex-col min-h-0 border-t border-border">
                <div className="px-4 h-10 flex items-center bg-gray-50/50 border-b border-border">
                  <span className="text-xs font-bold text-gray-500 uppercase">图层结构</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <LayerTree />
                </div>
              </div>
            )}
          </div>
        </Sider>

        {/* Main Content - Canvas */}
        <Content className="relative bg-gray-100 flex flex-col overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-50">
              <Spin size="large" />
              <span className="mt-4 text-xs text-gray-500">正在解析...</span>
            </div>
          )}

          {!psdDoc && !isLoading && (
            <EmptyState onImport={selectDirectory} />
          )}

          {psdDoc && !isLoading && (
            <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8">
              {/* Canvas Container */}
              <div className="relative shadow-2xl bg-white" style={{ width: '100%', height: '100%' }}>
                 <CanvasViewer />
              </div>
            </div>
          )}
        </Content>

        {/* Right Sidebar - Properties */}
        {psdDoc && (
           <Sider width={280} className="bg-white border-l border-border flex flex-col z-20 shadow-sm" theme="light">
             <PropertiesPanel />
           </Sider>
        )}
      </Layout>
    </ConfigProvider>
  );
}

// Empty State
const EmptyState = ({ onImport }: { onImport: () => void }) => (
  <div className="h-full flex flex-col items-center justify-center text-gray-400 select-none">
    <div className="w-20 h-20 mb-4 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-200">
      <FileOutlined className="text-3xl text-blue-500" />
    </div>
    <h2 className="text-sm font-medium text-gray-700 mb-2">暂无文件</h2>
    <Button type="primary" onClick={onImport} className="bg-blue-600">
      打开目录
    </Button>
  </div>
);

export default App;