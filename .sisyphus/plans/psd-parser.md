# PSD 文件解析查看器

## TL;DR

> **快速摘要**: 开发一个纯浏览器端的 PSD 文件查看器，支持解析 PSD 文件结构、图层树展示、点击选中图层、属性面板显示（文本/图片）、一键复制属性值、导出图层为 PNG。类似蓝湖的本地版本。
> 
> **交付物**: 
> - 完整的 React + Vite 项目
> - 目录浏览和 PSD 文件列表
> - Canvas 画布渲染 + 缩放平移
> - 图层树面板
> - 属性面板（文本/图片）
> - 一键复制 + 导出 PNG
> - 深色/浅色主题
> 
> **预估工作量**: Large（10-15 个任务）
> **并行执行**: YES - 3 个 Wave
> **关键路径**: 项目初始化 → PSD 解析核心 → Canvas 渲染 → 交互系统 → UI 面板

---

## Context

### Original Request
开发一套可以解析 PSD 文件的功能，参考蓝湖但只需要本地版本，无团队协作功能：
1. 获取指定目录下的所有 PSD 文件
2. 解析 PSD 画布的宽高、位置信息
3. 鼠标点击选中元素，右侧显示解析信息（文本/图片）
4. 点击属性值可复制
5. 重叠元素可透传选择

### Interview Summary
**关键决策**:
- **应用形式**: 纯浏览器 Web 应用（无后端）
- **技术栈**: React + TypeScript + Vite + Tailwind CSS + Ant Design
- **PSD 解析**: ag-psd 库
- **渲染**: HTML Canvas 2D
- **图层树**: 需要（左侧面板）
- **导出**: 支持导出图层为 PNG
- **颜色格式**: HEX
- **主题**: 深色/浅色双主题切换
- **重叠选择**: 右键菜单 + Ctrl+点击循环
- **文件模式**: 单文件模式
- **文件大小**: 不限制（大文件会提示性能警告）
- **UI 语言**: 中文

**研究发现**:
- ag-psd 完整支持：图层位置、文本属性（字体/大小/颜色/描边）、图层效果、智能对象
- File System Access API 需要 Chrome 86+ 支持

### Metis Review
**识别的差距** (已解决):
- ✅ 文件大小上限：不限制，添加性能提示
- ✅ 多文件模式：单文件
- ✅ UI 语言：中文
- ✅ 浏览器降级：Firefox/Safari 使用传统 input file
- ✅ 多画板：显示第一个画板
- ✅ 智能对象：扁平化显示

---

## Work Objectives

### Core Objective
开发一个本地 PSD 文件查看器，允许用户浏览目录中的 PSD 文件，查看图层结构，点击选中图层并查看其属性（文本样式、图片信息），支持一键复制属性值和导出图层为 PNG。

### Concrete Deliverables
- `src/` - 完整的 React 应用代码
- 目录/文件选择功能
- PSD 解析和 Canvas 渲染
- 图层树面板组件
- 属性面板组件
- 复制和导出功能
- 主题切换

### Definition of Done
- [ ] 可以选择目录或 PSD 文件
- [ ] PSD 画布正确渲染到 Canvas
- [ ] 点击 Canvas 可以选中对应图层
- [ ] 图层树正确显示层级结构
- [ ] 属性面板显示选中图层的完整信息
- [ ] 点击属性值可复制到剪贴板
- [ ] 可以导出选中图层为 PNG
- [ ] 深色/浅色主题可切换

### Must Have
- PSD 文件解析（ag-psd）
- Canvas 2D 渲染
- 图层树面板
- 属性面板（文本/图片）
- 一键复制
- 图层导出 PNG
- 主题切换

### Must NOT Have (Guardrails)
- ❌ 团队协作功能
- ❌ 云端存储/同步
- ❌ PSD 编辑功能（只读查看）
- ❌ 标注/批注功能
- ❌ 代码生成
- ❌ 测量标尺工具（元素间距离）- v1 不做
- ❌ 切图预设/批量导出 - v1 仅单图层导出
- ❌ 插件系统
- ❌ 桌面应用封装 (Electron/Tauri)
- ❌ PSB 格式支持
- ❌ Sketch/Figma/XD 文件支持

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO（新项目）
- **User wants tests**: 手动浏览器验证
- **Framework**: 无自动化测试

### Automated Verification (Playwright)

每个任务使用 Playwright 浏览器自动化验证：

**验证流程**:
1. Agent 使用 playwright skill 启动浏览器
2. 导航到 http://localhost:5173
3. 执行交互操作
4. 断言 DOM 状态或截图
5. 截图保存到 .sisyphus/evidence/

**Evidence Requirements:**
- 截图保存到 `.sisyphus/evidence/task-N-*.png`
- Console 错误检查
- DOM 状态验证

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: 项目初始化 (Vite + React + TS + Tailwind + Ant Design)
└── Task 2: 状态管理设计 (Zustand store 结构)

Wave 2 (After Wave 1):
├── Task 3: 文件选择系统 (File System Access API + 降级)
├── Task 4: PSD 解析核心 (ag-psd 集成)
└── Task 5: 主题系统 (深色/浅色切换)

Wave 3 (After Task 4):
├── Task 6: Canvas 渲染引擎 (图层绘制 + 缩放平移)
├── Task 7: 图层树面板 (左侧)
└── Task 8: 属性面板 (右侧)

Wave 4 (After Task 6):
├── Task 9: 点击选中系统 (Canvas 点击检测)
├── Task 10: 重叠元素选择 (右键菜单 + Ctrl+点击)
└── Task 11: 一键复制功能

Wave 5 (After Wave 4):
├── Task 12: 图层导出 PNG
└── Task 13: 最终集成和 UI 优化
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3,4,5,6,7,8 | 2 |
| 2 | None | 3,4,6,7,8,9 | 1 |
| 3 | 1,2 | - | 4,5 |
| 4 | 1,2 | 6,7,8,9,10,12 | 3,5 |
| 5 | 1 | - | 3,4 |
| 6 | 4 | 9,10,12 | 7,8 |
| 7 | 4,2 | - | 6,8 |
| 8 | 4,2 | 11 | 6,7 |
| 9 | 6 | 10 | - |
| 10 | 9 | - | 11 |
| 11 | 8 | - | 10,12 |
| 12 | 6 | 13 | 10,11 |
| 13 | All | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | `category="quick"`, `load_skills=["frontend-ui-ux"]` |
| 2 | 3, 4, 5 | `category="unspecified-low"` |
| 3 | 6, 7, 8 | `category="visual-engineering"`, `load_skills=["frontend-ui-ux"]` |
| 4 | 9, 10, 11 | `category="unspecified-low"` |
| 5 | 12, 13 | `category="visual-engineering"` |

---

## TODOs

- [ ] 1. 项目初始化

  **What to do**:
  - 使用 Vite 创建 React + TypeScript 项目
  - 安装依赖：tailwindcss, postcss, autoprefixer, antd, ag-psd, zustand
  - 配置 Tailwind CSS
  - 配置 Ant Design（ConfigProvider + 中文语言包）
  - 创建基础目录结构：
    ```
    src/
    ├── components/
    ├── hooks/
    ├── stores/
    ├── utils/
    ├── types/
    └── App.tsx
    ```

  **Must NOT do**:
  - 不安装测试相关依赖
  - 不添加 ESLint/Prettier（保持简单）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: 项目结构和配置

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: 3, 4, 5, 6, 7, 8
  - **Blocked By**: None

  **References**:
  - Vite 官方文档: https://vitejs.dev/guide/
  - Tailwind + Vite: https://tailwindcss.com/docs/guides/vite
  - Ant Design: https://ant.design/docs/react/introduce

  **Acceptance Criteria**:
  ```bash
  # 验证命令
  cd E:\Projects\PSDParse && npm run dev
  # 期望：Vite 启动成功，http://localhost:5173 可访问
  ```

  **Playwright 验证**:
  ```
  1. Navigate to: http://localhost:5173
  2. Assert: 页面无白屏，无 console error
  3. Screenshot: .sisyphus/evidence/task-1-init.png
  ```

  **Commit**: YES
  - Message: `feat: initialize vite react project with tailwind and antd`
  - Files: `package.json, vite.config.ts, tailwind.config.js, src/*`

---

- [ ] 2. 状态管理设计

  **What to do**:
  - 创建 Zustand store 结构
  - 定义核心类型：
    ```typescript
    // types/psd.ts
    interface PsdDocument {
      width: number;
      height: number;
      layers: PsdLayer[];
    }
    
    interface PsdLayer {
      id: string;
      name: string;
      type: 'text' | 'image' | 'group' | 'shape' | 'adjustment';
      bounds: { top: number; left: number; bottom: number; right: number };
      visible: boolean;
      opacity: number;
      children?: PsdLayer[];
      textInfo?: TextLayerInfo;
      imageInfo?: ImageLayerInfo;
      canvas?: HTMLCanvasElement;
    }
    
    interface TextLayerInfo {
      text: string;
      fontFamily: string;
      fontSize: number;
      color: string; // HEX
      strokeColor?: string;
      // ...
    }
    ```
  - 创建 stores：
    - `psdStore`: 当前 PSD 文档和图层数据
    - `selectionStore`: 选中的图层
    - `uiStore`: 主题、缩放级别、平移偏移

  **Must NOT do**:
  - 不使用 Redux（过重）
  - 不创建多余的 store

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: 3, 4, 6, 7, 8, 9
  - **Blocked By**: None

  **References**:
  - Zustand: https://zustand-demo.pmnd.rs/
  - ag-psd 类型定义: 参考 context7 查询结果

  **Acceptance Criteria**:
  ```typescript
  // 类型检查通过
  npx tsc --noEmit
  // 期望：无类型错误
  ```

  **Commit**: YES
  - Message: `feat: add zustand stores and psd types`
  - Files: `src/stores/*.ts, src/types/*.ts`

---

- [ ] 3. 文件选择系统

  **What to do**:
  - 实现文件选择 hook: `useFileSystem`
  - 优先使用 File System Access API (`showDirectoryPicker`)
  - 降级方案：传统 `<input type="file" webkitdirectory>`
  - 功能：
    - 选择目录，列出所有 .psd 文件
    - 选择单个 PSD 文件
    - 文件列表显示（左侧边栏）
  - 创建 FileList 组件（使用 Ant Design List）

  **Must NOT do**:
  - 不实现文件内容预览（只显示文件名）
  - 不实现文件搜索/过滤（v1 不需要）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 4, 5)
  - **Blocks**: None
  - **Blocked By**: 1, 2

  **References**:
  - File System Access API: https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
  - showDirectoryPicker: https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker

  **Acceptance Criteria**:
  **Playwright 验证**:
  ```
  1. Navigate to: http://localhost:5173
  2. Click: "选择目录" 按钮
  3. 选择包含 PSD 文件的目录（需要手动准备测试目录）
  4. Assert: 文件列表显示 .psd 文件
  5. Screenshot: .sisyphus/evidence/task-3-file-list.png
  ```

  **Commit**: YES
  - Message: `feat: add file system api with directory picker`
  - Files: `src/hooks/useFileSystem.ts, src/components/FileList.tsx`

---

- [ ] 4. PSD 解析核心

  **What to do**:
  - 集成 ag-psd 库
  - 创建 PSD 解析服务：`utils/psdParser.ts`
  - 实现功能：
    - 解析 PSD 文件为内部数据结构
    - 递归处理图层和组
    - 提取文本图层信息（字体、大小、颜色、描边）
    - 提取图片/智能对象信息（名称、尺寸）
    - 提取图层效果（阴影、描边）
    - RGB 颜色转 HEX 格式
  - 大文件性能提示（>100MB 显示警告）

  **Must NOT do**:
  - 不解析 CMYK 颜色（仅 RGB）
  - 不处理 PSB 格式

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []
    - 纯逻辑代码，无需特殊 skill

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 3, 5)
  - **Blocks**: 6, 7, 8, 9, 10, 12
  - **Blocked By**: 1, 2

  **References**:
  - ag-psd README: https://github.com/agamnentzar/ag-psd
  - ag-psd 类型定义（已查询）:
    - 图层位置: `top, left, bottom, right`
    - 文本: `text.text, text.style.font.name, text.style.fontSize, text.style.fillColor`
    - 效果: `effects.dropShadow[], effects.stroke[]`
    - 智能对象: `placedLayer, linkedFiles`

  **WHY Each Reference Matters**:
  - ag-psd 的 `readPsd()` 返回完整的 PSD 结构
  - `text.styleRuns[]` 包含多样式文本信息
  - `canvas` 属性包含图层的已渲染图像

  **Acceptance Criteria**:
  ```typescript
  // 单元测试（手动验证）
  import { parsePsd } from './utils/psdParser';
  const buffer = await file.arrayBuffer();
  const doc = parsePsd(buffer);
  console.log(doc.width, doc.height, doc.layers.length);
  // 期望：正确输出 PSD 尺寸和图层数量
  ```

  **Commit**: YES
  - Message: `feat: integrate ag-psd for psd parsing`
  - Files: `src/utils/psdParser.ts, src/types/psd.ts`

---

- [ ] 5. 主题系统

  **What to do**:
  - 创建主题 Context 或 Zustand slice
  - 实现深色/浅色主题切换
  - 配置 Tailwind 深色模式（class strategy）
  - 配置 Ant Design 主题（ConfigProvider theme）
  - 添加主题切换按钮到 Header
  - 持久化主题选择到 localStorage

  **Must NOT do**:
  - 不实现自定义主题（只有深色/浅色两种）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 3, 4)
  - **Blocks**: None
  - **Blocked By**: 1

  **References**:
  - Tailwind Dark Mode: https://tailwindcss.com/docs/dark-mode
  - Ant Design 主题: https://ant.design/docs/react/customize-theme

  **Acceptance Criteria**:
  **Playwright 验证**:
  ```
  1. Navigate to: http://localhost:5173
  2. Assert: 初始主题为系统偏好或 localStorage 存储值
  3. Click: 主题切换按钮
  4. Assert: 背景色切换
  5. 刷新页面
  6. Assert: 主题状态保持
  7. Screenshot: .sisyphus/evidence/task-5-theme-dark.png, task-5-theme-light.png
  ```

  **Commit**: YES
  - Message: `feat: add dark/light theme toggle`
  - Files: `src/stores/uiStore.ts, src/components/ThemeToggle.tsx`

---

- [ ] 6. Canvas 渲染引擎

  **What to do**:
  - 创建 Canvas 渲染组件：`CanvasViewer.tsx`
  - 实现功能：
    - 将 PSD 图层绘制到 Canvas
    - 按图层顺序（z-index）绘制
    - 处理图层可见性
    - 缩放功能（滚轮缩放）
    - 平移功能（拖拽平移）
    - 选中图层高亮边框（蓝色虚线）
    - 画布背景棋盘格（透明区域指示）
  - 使用 requestAnimationFrame 优化渲染

  **Must NOT do**:
  - 不实现实时混合模式渲染（只显示图层 canvas）
  - 不实现图层滤镜效果

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Canvas 交互和视觉效果

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 7, 8)
  - **Blocks**: 9, 10, 12
  - **Blocked By**: 4

  **References**:
  - Canvas 2D API: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
  - ag-psd layer.canvas: 每个图层的已渲染图像

  **Acceptance Criteria**:
  **Playwright 验证**:
  ```
  1. Navigate to: http://localhost:5173
  2. 选择一个 PSD 文件
  3. Assert: Canvas 显示 PSD 内容
  4. 滚轮缩放
  5. Assert: 画布缩放
  6. 拖拽平移
  7. Assert: 画布平移
  8. Screenshot: .sisyphus/evidence/task-6-canvas.png
  ```

  **Commit**: YES
  - Message: `feat: add canvas viewer with zoom and pan`
  - Files: `src/components/CanvasViewer.tsx, src/hooks/useCanvasTransform.ts`

---

- [ ] 7. 图层树面板

  **What to do**:
  - 创建图层树组件：`LayerTree.tsx`
  - 使用 Ant Design Tree 组件
  - 实现功能：
    - 显示图层层级结构
    - 组可展开/折叠
    - 显示图层类型图标（文本/图片/组/形状）
    - 显示可见性眼睛图标
    - 点击选中图层（同步到 Canvas）
    - 选中图层高亮
    - 超长图层名截断 + tooltip
    - 虚拟滚动（大量图层时性能优化）

  **Must NOT do**:
  - 不实现图层拖拽排序
  - 不实现图层可见性切换（只显示状态）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 6, 8)
  - **Blocks**: None
  - **Blocked By**: 4, 2

  **References**:
  - Ant Design Tree: https://ant.design/components/tree
  - Tree 虚拟滚动: `height` + `virtual` props

  **Acceptance Criteria**:
  **Playwright 验证**:
  ```
  1. 打开 PSD 文件
  2. Assert: 左侧显示图层树
  3. 展开一个组
  4. Assert: 子图层显示
  5. 点击图层
  6. Assert: Canvas 中对应图层高亮
  7. Screenshot: .sisyphus/evidence/task-7-layer-tree.png
  ```

  **Commit**: YES
  - Message: `feat: add layer tree panel with expand/collapse`
  - Files: `src/components/LayerTree.tsx`

---

- [ ] 8. 属性面板

  **What to do**:
  - 创建属性面板组件：`PropertiesPanel.tsx`
  - 根据选中图层类型显示不同内容：
  
  **文本图层**:
  - 文本内容（可复制）
  - 字体名称（可复制）
  - 字体大小（可复制）
  - 文字颜色（HEX，可复制，显示色块）
  - 描边颜色（如有）
  - 行高、字间距（如有）
  - 位置（left, top, width, height）

  **图片/智能对象图层**:
  - 图层名称（可复制）
  - 尺寸 (width x height)（可复制）
  - 位置 (left, top)
  - 如果是智能对象，显示链接文件名

  **通用信息**:
  - 图层类型
  - 透明度
  - 混合模式
  - 效果列表（阴影、描边等）

  - 使用 Ant Design Descriptions 或 Form 展示
  - 每个可复制的值旁边显示复制图标

  **Must NOT do**:
  - 不实现属性编辑功能

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 6, 7)
  - **Blocks**: 11
  - **Blocked By**: 4, 2

  **References**:
  - Ant Design Descriptions: https://ant.design/components/descriptions
  - ag-psd text.style 属性（已查询）

  **Acceptance Criteria**:
  **Playwright 验证**:
  ```
  1. 打开 PSD 文件，选中一个文本图层
  2. Assert: 右侧面板显示文本属性（字体、大小、颜色）
  3. 选中一个图片图层
  4. Assert: 右侧面板显示图片属性（名称、尺寸）
  5. Screenshot: .sisyphus/evidence/task-8-properties-text.png, task-8-properties-image.png
  ```

  **Commit**: YES
  - Message: `feat: add properties panel for text and image layers`
  - Files: `src/components/PropertiesPanel.tsx`

---

- [ ] 9. 点击选中系统

  **What to do**:
  - 实现 Canvas 点击检测逻辑
  - 计算点击位置对应的图层（考虑缩放和平移偏移）
  - 从顶层到底层遍历，找到第一个包含点击点的可见图层
  - 使用图层 bounds 判断点击范围
  - 可选：使用像素透明度判断（如果图层有 canvas）
  - 点击空白区域取消选中
  - 同步更新图层树选中状态

  **Must NOT do**:
  - 不实现多选（只支持单选）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: 10
  - **Blocked By**: 6

  **References**:
  - Canvas 坐标转换: 需要考虑 scale 和 translate

  **Acceptance Criteria**:
  **Playwright 验证**:
  ```
  1. 打开 PSD 文件
  2. 点击 Canvas 上的一个图层
  3. Assert: 该图层被选中（高亮边框显示）
  4. Assert: 属性面板显示该图层信息
  5. Assert: 图层树中对应项高亮
  6. Screenshot: .sisyphus/evidence/task-9-selection.png
  ```

  **Commit**: YES
  - Message: `feat: add canvas click to select layer`
  - Files: `src/hooks/useLayerHitTest.ts, src/components/CanvasViewer.tsx`

---

- [ ] 10. 重叠元素选择

  **What to do**:
  - 实现右键菜单：当点击位置有多个重叠图层时
    - 使用 Ant Design Dropdown/Menu
    - 列出所有重叠图层（按 z-index 顺序）
    - 点击菜单项选中对应图层
  - 实现快捷键循环：Ctrl+点击
    - 在重叠图层之间循环切换
    - 从当前选中向下一个循环

  **Must NOT do**:
  - 不实现自定义快捷键

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with 11)
  - **Blocks**: None
  - **Blocked By**: 9

  **References**:
  - Ant Design Dropdown: https://ant.design/components/dropdown
  - Context Menu 模式

  **Acceptance Criteria**:
  **Playwright 验证**:
  ```
  1. 在有重叠图层的位置右键点击
  2. Assert: 显示菜单列出所有重叠图层
  3. 点击菜单项
  4. Assert: 对应图层被选中
  5. Ctrl+点击重叠区域多次
  6. Assert: 选中图层循环切换
  7. Screenshot: .sisyphus/evidence/task-10-overlap-menu.png
  ```

  **Commit**: YES
  - Message: `feat: add overlapping layer selection (context menu + ctrl+click)`
  - Files: `src/components/LayerContextMenu.tsx, src/hooks/useLayerCycle.ts`

---

- [ ] 11. 一键复制功能

  **What to do**:
  - 为属性面板中的可复制值添加复制功能
  - 使用 Clipboard API: `navigator.clipboard.writeText()`
  - 复制后显示成功提示（Ant Design message）
  - 可复制的值：
    - 文本内容
    - 字体名称
    - 字体大小（带单位 px）
    - 颜色值（HEX 格式）
    - 尺寸（width x height）
    - 位置坐标
    - 图层名称

  **Must NOT do**:
  - 不实现批量复制

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with 10, 12)
  - **Blocks**: None
  - **Blocked By**: 8

  **References**:
  - Clipboard API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
  - Ant Design Message: https://ant.design/components/message

  **Acceptance Criteria**:
  **Playwright 验证**:
  ```
  1. 选中一个图层
  2. 点击颜色值旁边的复制按钮
  3. Assert: 显示 "复制成功" 提示
  4. 粘贴到文本框验证（或检查剪贴板）
  5. Screenshot: .sisyphus/evidence/task-11-copy.png
  ```

  **Commit**: YES
  - Message: `feat: add one-click copy for property values`
  - Files: `src/components/CopyableValue.tsx`

---

- [ ] 12. 图层导出 PNG

  **What to do**:
  - 添加导出按钮到属性面板或右键菜单
  - 使用图层的 canvas 导出为 PNG
  - 调用 `canvas.toBlob()` + `URL.createObjectURL()` + `<a download>`
  - 文件名使用图层名称（去除特殊字符）
  - 如果图层没有 canvas（如调整图层），显示 "无法导出" 提示

  **Must NOT do**:
  - 不实现批量导出
  - 不实现导出格式选择（只支持 PNG）
  - 不实现导出尺寸调整

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with 10, 11)
  - **Blocks**: 13
  - **Blocked By**: 6

  **References**:
  - Canvas toBlob: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
  - 文件下载: 创建隐藏 `<a>` 元素触发下载

  **Acceptance Criteria**:
  **Playwright 验证**:
  ```
  1. 选中一个图片图层
  2. 点击 "导出 PNG" 按钮
  3. Assert: 浏览器触发下载
  4. 验证下载的文件是有效 PNG
  5. Screenshot: .sisyphus/evidence/task-12-export.png
  ```

  **Commit**: YES
  - Message: `feat: add export layer as png`
  - Files: `src/utils/exportLayer.ts, src/components/ExportButton.tsx`

---

- [ ] 13. 最终集成和 UI 优化

  **What to do**:
  - 整合所有组件到主布局
  - 布局结构：
    ```
    +------------------+------------------+------------------+
    |     Header       |  (主题切换按钮)  |                  |
    +------------------+------------------+------------------+
    |   File List      |   Canvas Viewer  |  Properties      |
    |   (可折叠)       |   (缩放/平移)    |  Panel           |
    +------------------+------------------+------------------+
    |   Layer Tree     |                  |                  |
    +------------------+------------------+------------------+
    ```
  - 使用 Ant Design Layout (Sider + Content)
  - 响应式布局（Sider 可折叠）
  - 加载状态处理（解析 PSD 时显示 loading）
  - 错误边界处理（PSD 解析失败时显示友好提示）
  - 空状态处理（未选择文件时显示引导）
  - 性能优化（大文件警告提示）
  - UI 细节打磨（间距、颜色、动画）

  **Must NOT do**:
  - 不添加新功能

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final (after all)
  - **Blocks**: None
  - **Blocked By**: All previous tasks

  **References**:
  - Ant Design Layout: https://ant.design/components/layout
  - Ant Design Spin: https://ant.design/components/spin
  - Ant Design Result: https://ant.design/components/result (空状态/错误)

  **Acceptance Criteria**:
  **Playwright 验证**:
  ```
  1. Navigate to: http://localhost:5173
  2. Assert: 显示空状态引导 "请选择目录或 PSD 文件"
  3. 选择 PSD 文件
  4. Assert: Loading 状态显示
  5. 解析完成后，Assert: 完整 UI 显示（文件列表、Canvas、图层树、属性面板）
  6. 切换主题
  7. 完整功能流程测试
  8. Screenshot: .sisyphus/evidence/task-13-final.png
  ```

  **Commit**: YES
  - Message: `feat: integrate all components and polish ui`
  - Files: `src/App.tsx, src/components/Layout.tsx`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat: initialize vite react project with tailwind and antd` | package.json, vite.config.ts, tailwind.config.js, src/* | npm run dev |
| 2 | `feat: add zustand stores and psd types` | src/stores/*.ts, src/types/*.ts | npx tsc --noEmit |
| 3 | `feat: add file system api with directory picker` | src/hooks/useFileSystem.ts, src/components/FileList.tsx | 浏览器验证 |
| 4 | `feat: integrate ag-psd for psd parsing` | src/utils/psdParser.ts, src/types/psd.ts | 控制台测试 |
| 5 | `feat: add dark/light theme toggle` | src/stores/uiStore.ts, src/components/ThemeToggle.tsx | 浏览器验证 |
| 6 | `feat: add canvas viewer with zoom and pan` | src/components/CanvasViewer.tsx, src/hooks/useCanvasTransform.ts | 浏览器验证 |
| 7 | `feat: add layer tree panel with expand/collapse` | src/components/LayerTree.tsx | 浏览器验证 |
| 8 | `feat: add properties panel for text and image layers` | src/components/PropertiesPanel.tsx | 浏览器验证 |
| 9 | `feat: add canvas click to select layer` | src/hooks/useLayerHitTest.ts, src/components/CanvasViewer.tsx | 浏览器验证 |
| 10 | `feat: add overlapping layer selection (context menu + ctrl+click)` | src/components/LayerContextMenu.tsx, src/hooks/useLayerCycle.ts | 浏览器验证 |
| 11 | `feat: add one-click copy for property values` | src/components/CopyableValue.tsx | 浏览器验证 |
| 12 | `feat: add export layer as png` | src/utils/exportLayer.ts, src/components/ExportButton.tsx | 下载验证 |
| 13 | `feat: integrate all components and polish ui` | src/App.tsx, src/components/Layout.tsx | 完整功能验证 |

---

## Success Criteria

### Verification Commands
```bash
# 开发服务器启动
npm run dev
# Expected: Vite 启动成功，http://localhost:5173 可访问

# 类型检查
npx tsc --noEmit
# Expected: 无错误

# 构建
npm run build
# Expected: 成功构建到 dist/
```

### Final Checklist
- [ ] 可以选择目录浏览 PSD 文件
- [ ] PSD 画布正确渲染
- [ ] 图层树正确显示层级
- [ ] 点击选中图层功能正常
- [ ] 重叠元素选择（右键菜单 + Ctrl+点击）正常
- [ ] 属性面板显示正确信息
- [ ] 一键复制功能正常
- [ ] 导出 PNG 功能正常
- [ ] 深色/浅色主题切换正常
- [ ] 无 console 错误
- [ ] 所有 "Must NOT Have" 功能未实现
