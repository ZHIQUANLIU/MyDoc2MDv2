# Doc2MD v2 架构实现方案 (Implementation Details)

本项目最初是一个纯 Python 的应用，为了获得更极致的桌面端原生体验和现代化的 "Glassmorphism (玻璃拟态)" 界面，本版本采用 **Rust (Tauri) + Python Sidecar** 的混合架构实现了全面重构。

## 1. 架构选型分析

由于 PDF 的高质量文本/图像剥离高度依赖 `PyMuPDF4LLM`，而该库目前仅存在于 Python 生态中。如果在纯 Rust 中实现相同效果将需要海量的底层算法重写。因此，我们选用了 **Tauri 架构**：

- **Frontend (UI层)**：使用纯 HTML/CSS/JS 构建。无 Node.js 依赖负担，通过 CSS 原生 `backdrop-filter` 实现性能极佳的高斯模糊透明质感界面。
- **Backend (Rust层)**：作为整个系统的指挥官。它拦截前端发出的 UI 指令，处理路径转义清洗，调度异步并发任务。
- **Engine (Python Sidecar)**：剥离出来的纯逻辑执行器 (`engine.py`)。它只负责接收参数、读取 PDF、处理 AI 修复、保存文件，并通过 `stdout/stderr` 汇报进度。

## 2. 核心模块解析

### 2.1 玻璃拟态前端 (`frontend/`)
我们配置了 `tauri.conf.json`，使其生成一个**完全无边框 (frameless) 且背景透明 (transparent)** 的窗口。
前端样式 `style.css` 设定了全屏 `radial-gradient` 渐变色背景，并对控制面板应用了 `rgba(255, 255, 255, 0.05)` 与 `backdrop-filter: blur(20px)`，完美重现了现代化的玻璃堆叠质感。前端直接调用 `window.__TAURI__.tauri.invoke` 与 Rust 后端双向通信。

### 2.2 Rust 主进程调度 (`src/main.rs`)
当用户触发文件转换时，Rust 接收前端传来的路径与配置：
1. **自动路径清洗**：通过 `chars().map` 进行安全字符筛选，防止特殊字符导致 Windows 创建目录失败。
2. **目录构建**：使用 `std::fs::create_dir_all` 预先构建好属于该任务的专属文件夹结构。
3. **动态脚本部署**：利用 Rust 的 `include_str!` 宏，在编译期将 `engine.py` 打包进入可执行文件中。运行时自动将其释放到系统临时目录。
4. **进程管道通信**：Rust 使用 `tokio::process::Command` 无窗口 (`CREATE_NO_WINDOW`) 启动 Python 进程。将 `stdout` 与 `stderr` 通过 Tokio 异步流按行读取，并利用 Tauri 的事件分发系统 (`app_handle.emit_all`) 实时回传给前端，实现动态日志控制台监控。

### 2.3 Python 转换引擎 (`src/engine.py`)
一个轻量化的 CLI 脚本，接收 `--file`, `--outdir`, `--model`, `--use-ai` 等参数：
- 它直接调用 `pymupdf4llm.to_markdown()` 生成 Markdown 字符串，并通过参数 `image_path` 和 `write_images=True` 把内嵌图片自动释出到专门的 `images/` 子目录中。
- 执行正则表达式替换：自动将绝对或错误的图片路径修复为相对路径（例如 `![](images/image-1.png)`）。
- 可选调用 `google.generativeai` 接口发送整理提示词。
- 整个生命周期内通过 `print()` 向外输出关键执行节点进度，从而让外层 Rust 进程能感知当前状态。

## 3. 性能与优势
- **冷启动极速**：Rust 和 Tauri 的冷启动在几十毫秒级，体积也极为轻量。
- **高度解耦**：前端样式、后端系统 API 调用、PDF 分析引擎完全独立，维护成本大幅度降低。
- **跨平台一致性**：不论在 Windows 10 还是 Windows 11，Tauri 内核 WebView2 都能极好地支撑此类高级前端特效渲染。
