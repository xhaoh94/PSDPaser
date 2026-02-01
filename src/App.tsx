import { useEffect, useState } from 'react';
import { ConfigProvider, theme, Layout, Typography, Spin, message } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useUiStore, usePsdStore } from './stores';
import { FileList } from './components/FileList';
import { ThemeToggle } from './components/ThemeToggle';
import { parsePsdFromFile, checkFileSizeWarning } from './utils/psdParser';
import type { PsdFile } from './hooks/useFileSystem';
import './App.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

function App() {
  const { theme: currentTheme } = useUiStore();
  const { setDocument, setLoading, setError, isLoading, document, fileName } = usePsdStore();
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
          className={`flex items-center justify-between px-4 ${
            isDark ? 'bg-gray-800' : 'bg-white'
          } border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
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

        <Layout>
          {/* 左侧面板 - 文件列表 */}
          <Sider
            width={280}
            className={`${isDark ? 'bg-gray-800' : 'bg-white'} border-r ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <FileList onFileSelect={handleFileSelect} selectedFile={selectedFile} />
          </Sider>

          {/* 主内容区 - Canvas */}
          <Content
            className={`relative ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                <Spin size="large" tip="解析 PSD 文件中..." />
              </div>
            )}

            {!document && !isLoading && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Text type="secondary" className="text-lg">
                    请从左侧选择 PSD 文件
                  </Text>
                </div>
              </div>
            )}

            {document && !isLoading && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Text className="text-lg block mb-2">
                    已加载: {fileName}
                  </Text>
                  <Text type="secondary">
                    尺寸: {document.width} x {document.height}
                  </Text>
                  <Text type="secondary" className="block">
                    图层数: {document.layers.length}
                  </Text>
                  <div className="mt-4 text-sm text-gray-500">
                    Canvas 渲染器将在后续任务中实现
                  </div>
                </div>
              </div>
            )}
          </Content>

          {/* 右侧面板 - 属性面板 */}
          <Sider
            width={300}
            className={`${isDark ? 'bg-gray-800' : 'bg-white'} border-l ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <div className="p-4">
              <Title level={5}>属性</Title>
              <Text type="secondary">
                选择图层后显示属性信息
              </Text>
            </div>
          </Sider>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
