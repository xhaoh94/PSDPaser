# PSDParser

离线 PSD 文件解析工具，在线查看元素效果，减少美术标注的时间。
支持将 Photoshop (PSD) 文件导出为 FairyGUI (FGUI) 格式。（可配置）

## 功能特性

- **离线解析**：无需上传文件到服务器，在本地安全解析 PSD 文件
- **图层可视化**：直观的图层树展示和画布预览
- **FGUI 导出**：一键导出 PSD 到 FairyGUI 格式
- **自定义命名规则**：支持灵活的图层命名规范配置

## 技术栈

- **前端框架**：React 19 + Vite
- **状态管理**：Zustand
- **UI 组件库**：Ant Design 6
- **样式方案**：Tailwind CSS 4
- **PSD 解析**：ag-psd、psd
- **开发语言**：TypeScript

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 开发模式

Windows 环境下，直接运行启动脚本：

```bash
start_dev.bat
```

或手动执行：

```bash
npm install
npm run dev
```

### 生产构建

```bash
npm run build
npm run preview
```

### 代码检查

```bash
npm run lint
```

## 配置说明

### FGUI 导出配置

导出功能配置文件位于 `public/fgui.json`，包含以下配置项：

```json
{
  "enabled": true,
  "fguiProjectDir": "C:\\Project\\YourFGUIProject",
  "namingRules": {
    "prefixes": {
      "common": "Common@"
    },
    "suffixes": {
      "noExport": "@NoExport",
      "img": "@img",
      "input": "@txt",
      "rich": "@rich"
    },
    "componentPrefix": {
      "Com": { "type": "Component", "prefix": "com" },
      "Btn": { "type": "Button", "prefix": "btn" },
      "ChkBtn": { "type": "Button", "prefix": "chk" }
    }
  }
}
```

**配置说明：**

- `enabled`：是否启用 FGUI 导出功能
- `fguiProjectDir`：FGUI 工程目录路径
- `namingRules`：图层命名规则
  - `prefixes`：前缀规则
  - `suffixes`：后缀规则（如 `@NoExport` 表示不导出该图层）
  - `componentPrefix`：组件类型映射规则

## 使用指南

### 基本使用流程

1. 点击"选择 PSD 文件"按钮导入文件
2. 在左侧图层树中查看和选择图层
3. 在右侧画布中预览图层效果
4. 在属性面板中查看图层详细信息
5. 点击"导出 FGUI"按钮生成 FGUI 资源

### 命名规范

使用特定的命名规则可以优化导出结果：

- `@NoExport`：不导出该图层
- `@img`：导出为图片资源
- `@txt`：导出为输入框组件
- `@rich`：导出为富文本组件
- `Com`：导出为普通组件
- `Btn`：导出为按钮组件
- `ChkBtn`：导出为复选框按钮

## 部署为本地服务

推荐使用 NSSM 将应用封装为 Windows 服务，实现自动启动和开机自启：

1. 下载并安装 [NSSM](https://nssm.cc/)
2. 运行 `start_npx_serve_5173.bat` 前需修改其中的路径为当前目录的绝对路径
3. 使用 NSSM 注册该批处理文件为服务：
   ```bash
   nssm install PSDParser "C:\Project\PSDPaser\start_npx_serve_5173.bat"
   nssm start PSDParser
   ```

**优点：**
- 无黑窗运行
- 支持开机自启
- 便于服务管理

### 离线环境部署

在完全离线的环境中，如果无法使用 `npx` 命令，可以使用 Python 的内置 HTTP 服务器：

```bash
python -m http.server 5173 --directory dist
```

或查看 `start_npx_serve_5173.bat` 文件中的详细说明。

## 项目结构

```
PSDPaser/
├── public/           # 静态资源和配置文件
│   └── fgui.json     # FGUI 导出配置
├── src/
│   ├── components/   # React 组件
│   ├── hooks/        # 自定义 Hooks
│   ├── stores/       # Zustand 状态管理
│   ├── types/        # TypeScript 类型定义
│   ├── utils/        # 工具函数
│   │   └── fgui/     # FGUI 导出相关工具
│   └── workers/      # Web Workers
└── scripts/          # 脚本文件
```

## 许可证

ISC

## 链接

- GitHub: https://github.com/xhaoh94/PSDPaser
- Issues: https://github.com/xhaoh94/PSDPaser/issues
