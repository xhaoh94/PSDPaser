import { useEffect, useState, useRef, useCallback } from 'react';
import { ConfigProvider, theme, Layout, Spin, message, Button, Tooltip, Modal } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { 
  FolderOpenOutlined, 
  FileOutlined,
  ReloadOutlined,
  ExportOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { usePsdStore, useUiStore, useSelectionStore } from './stores';
import { useConfigStore } from './stores/configStore';
import { FileList } from './components/FileList';
import { CanvasViewer } from './components/CanvasViewer';
import { LayerTree } from './components/LayerTree';
import { PropertiesPanel } from './components/PropertiesPanel';
import { FguiSettingsModal } from './components/FguiSettingsModal';
import { FguiExportModal } from './components/FguiExportModal';
import { FguiExporter } from './utils/fgui/exporter';
import { parsePsdFromFileAsync, checkFileSizeWarning, isAsyncParsingSupported, parsePsdFromFile } from './utils/psdParser';
import { psdCache } from './utils/psdCache';
import { useFileSystem } from './hooks/useFileSystem';
import { saveExportHistory, loadExportHistory } from './stores/fileSystemStore';
import type { PsdFileInfo } from './hooks/useFileSystem';
import './App.css';

const { Sider, Content } = Layout;

function App() {
  const { setDocument, setLoading, setError, isLoading, document: psdDoc, fileName: currentFileName } = usePsdStore();
  const { layerPanelHeight, setLayerPanelHeight, leftSiderWidth, setLeftSiderWidth } = useUiStore();
  const { clearSelection } = useSelectionStore();
  const { fguiProjectName, fguiDirHandle, largeImageThreshold, fetchServerConfig, serverConfig, restoreFguiDirectory, getNamingRules } = useConfigStore();
  const [selectedFile, setSelectedFile] = useState<PsdFileInfo | null>(null);
  const [parseProgress, setParseProgress] = useState<number>(0);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // 记忆的导出配置
  const [rememberedExport, setRememberedExport] = useState<{packageName: string, viewName: string} | null>(null);

  const { selectDirectory, refreshDirectory, getFile } = useFileSystem();

  // 加载服务器配置
  useEffect(() => {
    fetchServerConfig();
    restoreFguiDirectory();
  }, [fetchServerConfig, restoreFguiDirectory]);

  // 垂直 Resizer (图层面板高度)
  const isResizingVerticalRef = useRef(false);
  // 水平 Resizer (左侧栏宽度)
  const isResizingHorizontalRef = useRef(false);
  const siderRef = useRef<HTMLDivElement>(null);
  
  const handleVerticalMouseDown = useCallback(() => {
    isResizingVerticalRef.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleHorizontalMouseDown = useCallback(() => {
    isResizingHorizontalRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 垂直拖拽（图层面板高度）
      if (isResizingVerticalRef.current) {
        const sidebarHeight = window.innerHeight - 48;
        const newHeight = sidebarHeight - (e.clientY - 48);
        const percentage = (newHeight / sidebarHeight) * 100;
        setLayerPanelHeight(percentage);
      }
      
      // 水平拖拽（左侧栏宽度）
      if (isResizingHorizontalRef.current) {
        const newWidth = e.clientX;
        setLeftSiderWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizingVerticalRef.current = false;
      isResizingHorizontalRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setLayerPanelHeight, setLeftSiderWidth]);

  // Force Light Mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // 懒加载 PSD 文件（带 LRU 缓存）
  // 大文件使用 Web Worker 异步解析，避免 UI 卡顿
  const handleFileSelect = useCallback(async (fileInfo: PsdFileInfo) => {
    // 清除上一个文件的选中状态
    clearSelection();
    setSelectedFile(fileInfo);
    setParseProgress(0);
    
    // 检查缓存
    const cacheKey = fileInfo.relativePath;
    const cachedDoc = psdCache.get(cacheKey);
    
    if (cachedDoc) {
      console.log(`[App] 从缓存加载: ${fileInfo.name}`);
      setDocument(cachedDoc, fileInfo.name);
      // 加载历史配置
      const history = await loadExportHistory(fileInfo.relativePath);
      setRememberedExport(history);
      return;
    }
    
    // 文件大小警告
    const warning = checkFileSizeWarning(fileInfo.size);
    if (warning) message.warning(warning);

    setLoading(true);
    try {
      // 懒加载获取 File 对象
      const file = await getFile(fileInfo.relativePath);
      if (!file) {
        throw new Error('无法获取文件');
      }
      
      // 大文件 (>50MB) 使用 Worker 异步解析
      const useWorker = isAsyncParsingSupported() && file.size > 50 * 1024 * 1024;
      
      let doc;
      if (useWorker) {
        console.log(`[App] 使用 Worker 异步解析大文件: ${fileInfo.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
        doc = await parsePsdFromFileAsync(file, (progress) => {
          setParseProgress(Math.round(progress));
        });
      } else {
        doc = await parsePsdFromFile(file);
      }
      
      // 存入缓存
      psdCache.set(cacheKey, doc);
      
      setDocument(doc, fileInfo.name);

      // 加载历史配置
      const history = await loadExportHistory(fileInfo.relativePath);
      setRememberedExport(history);

      setParseProgress(100);
      message.success({ content: `已加载 ${fileInfo.name}`, key: 'loading' });
    } catch (err) {
      console.error(err);
      const errorMsg = (err as Error).message || '解析失败';
      setError(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(false);
      setParseProgress(0);
    }
  }, [getFile, setDocument, setError, setLoading, clearSelection]);

  // FGUI 导出处理
  const handleExportFgui = async (packageName: string, viewName: string) => {
    if (!psdDoc) return;
    
    const namingRules = getNamingRules();
    const exporter = new FguiExporter(fguiDirHandle!, largeImageThreshold, namingRules);

    // 检查界面是否已存在
    const exists = await exporter.checkViewExists(packageName, viewName);
    if (exists) {
      Modal.confirm({
        title: '界面已存在',
        icon: <ExclamationCircleOutlined />,
        content: `包 "${packageName}" 中已存在界面 "${viewName}"。继续导出将覆盖现有文件，是否继续？`,
        okText: '覆盖导出',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => performExport(exporter, packageName, viewName),
      });
    } else {
      performExport(exporter, packageName, viewName);
    }
  };

  const performExport = async (exporter: FguiExporter, packageName: string, viewName: string) => {
    setExportModalOpen(false);
    setIsExporting(true);
    try {
      await exporter.export(psdDoc!, packageName, viewName);
      // 保存导出历史
      if (selectedFile) {
        await saveExportHistory(selectedFile.relativePath, packageName, viewName);
        setRememberedExport({ packageName, viewName });
      }
      message.success('导出 FGUI 成功！');
    } catch (err) {
      console.error(err);
      message.error(`导出失败: ${(err as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const onExportClick = () => {
    if (!psdDoc || !currentFileName) return;
    
    // 如果没有 FGUI 目录句柄，提示配置
    if (!fguiDirHandle) {
      message.info('请先选择 FGUI 项目根目录以获取写入权限');
      setSettingsOpen(true);
      return;
    }

    setExportModalOpen(true);
  };

  const lightToken = {
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBorder: '#e8e8e8',
    colorText: '#333333',
    colorTextSecondary: '#666666',
    colorPrimary: '#1890ff',
    borderRadius: 4,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
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
      <Layout className="h-screen overflow-hidden bg-bg-app font-sans text-text-main flex-row">
        {/* Left Sidebar - Navigation & Layers */}
        <div 
          ref={siderRef}
          className="bg-white border-r border-border flex flex-col z-20 shadow-sm shrink-0"
          style={{ width: leftSiderWidth }}
        >
          <div className="flex flex-col h-full">
            {/* App Title / Logo Area (Minimal) */}
            <div className="h-12 flex items-center px-4 border-b border-border bg-gray-50/50 shrink-0 justify-between">
              <div className="font-bold text-lg text-gray-800 tracking-tight flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs">P</span>
                PSD 解析器
              </div>
            </div>

            {/* File Navigation */}
            <div className="flex flex-col min-h-0" style={{ height: psdDoc ? `calc(${100 - layerPanelHeight}% - 6px)` : '100%' }}>
              <div className="px-4 py-3 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-gray-500 uppercase">文件目录</span>
                <div className="flex items-center gap-1">
                  <Tooltip title="刷新目录">
                    <Button type="text" size="small" icon={<ReloadOutlined />} onClick={refreshDirectory} className="text-gray-500 hover:bg-gray-100" />
                  </Tooltip>
                  <Tooltip title="打开新目录">
                    <Button type="text" size="small" icon={<FolderOpenOutlined />} onClick={selectDirectory} className="text-blue-600 hover:bg-blue-50" />
                  </Tooltip>
                </div>
              </div>
              <div className="flex-1 overflow-hidden px-2">
                <FileList onFileSelect={handleFileSelect} selectedFile={selectedFile} />
              </div>
            </div>

            {/* Layer Tree (Bottom Half) */}
            {psdDoc && (
              <>
                {/* Vertical Resizer Handle - 图层面板拖拽分割线 */}
                <div 
                  className="shrink-0 cursor-row-resize select-none"
                  style={{ 
                    height: '8px', 
                    background: 'linear-gradient(to bottom, #e5e7eb 0%, #d1d5db 50%, #e5e7eb 100%)',
                    borderTop: '1px solid #d1d5db',
                    borderBottom: '1px solid #d1d5db',
                  }}
                  onMouseDown={handleVerticalMouseDown}
                >
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="w-10 h-0.5 bg-gray-400 rounded-full" />
                  </div>
                </div>
                
                <div className="flex flex-col min-h-0 bg-white" style={{ height: `${layerPanelHeight}%` }}>
                  <div className="px-4 h-10 flex items-center bg-gray-50/50 border-b border-border shrink-0">
                    <span className="text-xs font-bold text-gray-500 uppercase">图层结构</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <LayerTree />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Horizontal Resizer - 左侧栏与画布之间的拖拽条 */}
        <div
          className="shrink-0 cursor-col-resize select-none hover:bg-blue-400 transition-colors z-30 flex items-center justify-center"
          style={{ 
            width: '6px',
            background: 'linear-gradient(to right, #e5e7eb 0%, #d1d5db 50%, #e5e7eb 100%)',
          }}
          onMouseDown={handleHorizontalMouseDown}
        >
          <div className="w-0.5 h-10 bg-gray-400 rounded-full" />
        </div>

        {/* Main Content - Canvas */}
        <Content className="relative bg-gray-100 flex flex-col overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-50">
              <Spin size="large" />
              <span className="mt-4 text-xs text-gray-500">
                {parseProgress > 0 ? `正在解析... ${parseProgress}%` : '正在解析...'}
              </span>
              {parseProgress > 0 && (
                <div className="mt-2 w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-200 ease-out"
                    style={{ width: `${parseProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {!psdDoc && !isLoading && (
            <EmptyState onImport={selectDirectory} />
          )}

          {/* FGUI Export Button Overlay */}
          {psdDoc && !isLoading && (serverConfig?.enabled !== false) && (fguiProjectName || serverConfig?.enabled) && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <div className="pointer-events-auto">
                <Tooltip title={fguiProjectName ? `导出到: ${fguiProjectName}` : '需要设置导出目录'}>
                  <Button 
                    type="default" 
                    icon={<ExportOutlined />} 
                    loading={isExporting}
                    onClick={onExportClick}
                    className="shadow-sm border-gray-300 hover:border-gray-800 hover:text-gray-800 !rounded-none px-6 bg-white/90 backdrop-blur-sm"
                  >
                    导出 FGUI
                  </Button>
                </Tooltip>
              </div>
            </div>
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
      
      <FguiSettingsModal 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />

      <FguiExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExportFgui}
        defaultPackageName={rememberedExport?.packageName || currentFileName?.split('@')[0] || ''}
        defaultViewName={rememberedExport?.viewName || currentFileName?.split('@')[1]?.replace('.psd', '') || ''}
      />
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
