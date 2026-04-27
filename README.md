# Doc2MD v2

**Doc2MD v2** 是一款基于 **PyMuPDF4LLM** 引擎和 **Gemini 2.5 Flash** 视觉大模型的智能化 PDF 转换工具。全新版本采用 **Rust (Tauri)** 进行重构，结合轻量级的前端 Web 技术，为您带来无与伦比的高性能、现代化的玻璃拟态 UI 体验，同时保留了原生引擎强大的 PDF 解析能力。

![Doc2MD](icons/icon.ico)

## ✨ 核心特性

- **🚀 高性能 Rust 核心**：采用 Tauri 框架重构，多线程异步非阻塞运行，内存占用极低。
- **🌈 现代玻璃拟态 UI**：构建了绝美的高级深色模式界面，具有动态高斯模糊 (Backdrop Blur) 和优雅的渐变背景。
- **📂 自动化资源包管理**：为每个 PDF 自动创建专属文件夹，自动将 Markdown 文件与提取的图片资源（`images/`）统一归档并建立正确的相对路径链接。
- **🖼️ 视觉图片提取**：自动从 PDF 中剥离图片并保持高质量 PNG 格式，图文并茂。
- **🤖 Gemini 2.5 Flash 增强**：无缝对接最新的 Gemini 模型，对提取出的 Markdown 进行逻辑重组、OCR 修复及格式美化。
- **🛠️ 跨平台路径优化**：在底层 Rust 中自动清洗 Windows 非法路径字符，确保所有复杂文件名的稳定导出。

## 🛠️ 安装与运行

### 环境要求
1. **Rust / Cargo** (用于编译和运行 Tauri 框架)
2. **Python 3.x** (用于底层解析引擎)
3. Python 依赖：
   ```powershell
   pip install pymupdf4llm google-generativeai markdown2
   ```

### 启动项目
克隆或下载本项目后，进入 `MyDoc2MDv2` 根目录并执行：

```powershell
cargo run
```
这将自动下载 Rust 相关依赖包，编译核心组件，并启动应用程序。

## 📖 使用指南

1. **配置环境**：在左侧边栏输入你的 `Gemini API Key`（系统会自动安全地记住您的 Key），并选择输出目录（默认为 `Downloads`）。
2. **选择模型**：推荐使用 `Gemini 2.5 Flash` 以获得极速和高精度的视觉 OCR 修复。开启 `AI Refinement` 开关以启用增强功能。
3. **导入文件**：直接将您的 PDF 拖拽到主屏幕中间的 "Drop PDF here" 区域，或点击选中文件。
4. **实时预览**：底部日志台将实时输出转换进度，完成后您可以直接在 "PREVIEW" 面板看到极佳的排版预览。点击 "Open Output Folder" 快速直达您的成果。

## 📜 许可证

MIT License
