import { useEffect, useState, useCallback } from 'react';
import { ConfigProvider, theme, Layout, Typography, Spin, message } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useUiStore, usePsdStore, useSelectionStore } from './stores';
import { FileList } from './components/FileList';
import { ThemeToggle } from './components/ThemeToggle';
import { CanvasViewer } from './components/CanvasViewer';
import { LayerTree } from './components/LayerTree';
import { PropertiesPanel } from './components/PropertiesPanel';
import { parsePsdFromFile, checkFileSizeWarning } from './utils/psdParser';
import type { PsdFile } from './hooks/useFileSystem';
import type { PsdLayer } from './types/psd';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

function App() {
  const { theme: currentTheme } = useUiStore();
  const { setDocument, setLoading, setError, isLoading, document: psdDoc, fileName } = usePsdStore();
  const { selectLayer, setOverlappingLayers } = useSelectionStore();
  const [selectedFile, setSelectedFile] = useState<PsdFile | null>(null);

  // 根据主题添加/移除 dark 类
  useEffect(() => {
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [currentTheme]);

  // 处理文件选择
  const handleFileSelect = async (file: PsdFile) => {
    setSelectedFile(file);

    // 检查文件大小警告
    const warning = checkFileSizeWarning(file.size);
    if (warning) {
      message.warning(warning);
    }

    // 解析 PSD
    setLoading(true);
    try {
      const doc = await parsePsdFromFile(file.file);
      setDocument(doc, file.name);
      message.success(`成功加载 ${file.name}`);
    } catch (err) {
      const errorMsg = (err as Error).message || '解析 PSD 文件失败';
      setError(errorMsg);
      message.error(errorMsg);
    }
  };

  // 处理 Canvas 点击
  const handleLayerClick = useCallback(
    (layer: PsdLayer | null, layers: PsdLayer[]) => {
      selectLayer(layer);
      setOverlappingLayers(layers);
    },
    [selectLayer, setOverlappingLayers]
  );

  const isDark = currentTheme === 'dark';

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <Layout className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        {/* Header */}
        <Header
          className={`flex items-center justify-between px-4 h-14 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          } border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
          style={{ height: 56, lineHeight: '56px' }}
        >
          <Title level={4} className="!mb-0 !text-blue-500">
            PSD 文件解析器
          </Title>
          <div className="flex items-center gap-4">
            {fileName && (
              <Text type="secondary" className="text-sm">
                {fileName}
              </Text>
            )}
            <ThemeToggle />
          </div>
        </Header>

        <Layout style={{ height: 'calc(100vh - 56px)' }}>
          {/* 左侧面板 - 文件列表 + 图层树 */}
          <Sider
            width={280}
            className={`${isDark ? 'bg-gray-800' : 'bg-white'} border-r ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
            style={{ height: '100%', overflow: 'hidden' }}
          >
            <div className="h-full flex flex-col">
              {/* 文件列表（占 1/3） */}
              <div className="h-1/3 border-b border-gray-700 overflow-hidden">
                <FileList onFileSelect={handleFileSelect} selectedFile={selectedFile} />
              </div>
              {/* 图层树（占 2/3） */}
              <div className="flex-1 overflow-hidden">
                <LayerTree />
              </div>
            </div>
          </Sider>

          {/* 主内容区 - Canvas */}
          <Content
            className={`relative ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}
            style={{ height: '100%', overflow: 'hidden' }}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                <Spin size="large" tip="解析 PSD 文件中..." />
              </div>
            )}

            {!psdDoc && !isLoading && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Text type="secondary" className="text-lg">
                    请从左侧选择 PSD 文件
                  </Text>
                </div>
              </div>
            )}

            {psdDoc && !isLoading && (
              <CanvasViewer onLayerClick={handleLayerClick} />
            )}
          </Content>

          {/* 右侧面板 - 属性面板 */}
          <Sider
            width={300}
            className={`${isDark ? 'bg-gray-800' : 'bg-white'} border-l ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
            style={{ height: '100%', overflow: 'hidden' }}
          >
            <PropertiesPanel />
          </Sider>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
