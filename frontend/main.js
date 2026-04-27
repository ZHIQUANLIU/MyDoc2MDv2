const { invoke } = window.__TAURI__.tauri;
const { listen } = window.__TAURI__.event;
const { open } = window.__TAURI__.dialog;
const { appWindow } = window.__TAURI__.window;
const { homeDir, join } = window.__TAURI__.path;

let currentOutputDir = "";
let currentMD = "";

// Initialize
async function init() {
    // Controls
    document.getElementById('titlebar-minimize').onclick = () => appWindow.minimize();
    document.getElementById('titlebar-maximize').onclick = () => appWindow.toggleMaximize();
    document.getElementById('titlebar-close').onclick = () => appWindow.close();

    // Default Output Dir
    const defaultOutput = await join(await homeDir(), 'Downloads');
    currentOutputDir = defaultOutput;
    document.getElementById('output-dir').value = defaultOutput;

    // Load API Key if saved
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) document.getElementById('api-key').value = savedKey;
    
    // Save API Key on change
    document.getElementById('api-key').addEventListener('change', (e) => {
        localStorage.setItem('gemini_api_key', e.target.value);
    });

    logSystem("🚀 App initialized and ready.");
}

// Log function
function logMsg(message, type = 'info') {
    const logView = document.getElementById('log-view');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logView.appendChild(entry);
    logView.scrollTop = logView.scrollHeight;
}

function logSystem(message) { logMsg(message, 'system'); }
function logInfo(message) { logMsg(message, 'info'); }
function logError(message) { logMsg(message, 'error'); }

// Listen for backend logs
listen('log', (event) => {
    if (event.payload.level === 'error') {
        logError(event.payload.message);
    } else {
        logInfo(event.payload.message);
        // Simulate progress bar based on logs
        const pb = document.getElementById('progress-bar');
        if (event.payload.message.includes('Extracting')) pb.style.width = '30%';
        if (event.payload.message.includes('AI refinement')) pb.style.width = '70%';
        if (event.payload.message.includes('Process finished')) pb.style.width = '100%';
    }
});

// Select Directory
document.getElementById('btn-select-dir').addEventListener('click', async () => {
    const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: currentOutputDir
    });
    if (selected) {
        currentOutputDir = selected;
        document.getElementById('output-dir').value = selected;
        logSystem(`📁 Output directory changed to: ${selected}`);
    }
});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
    });
});

// Open Output Folder
document.getElementById('btn-open-folder').addEventListener('click', async () => {
    try {
        await invoke('open_folder', { path: currentOutputDir });
    } catch (e) {
        logError(`Failed to open folder: ${e}`);
    }
});

// Setup File Selection via dialog (fallback if drag drops aren't used)
document.getElementById('drop-zone').addEventListener('click', async () => {
    const selected = await open({
        multiple: false,
        filters: [{
            name: 'PDF',
            extensions: ['pdf']
        }]
    });
    
    if (selected) {
        startConversion(selected);
    }
});

// Drag and Drop (Native Tauri)
listen('tauri://file-drop', event => {
    const files = event.payload;
    if (files && files.length > 0) {
        const file = files[0];
        if (file.toLowerCase().endsWith('.pdf')) {
            startConversion(file);
        } else {
            logError("❌ Only PDF files are supported.");
        }
    }
    document.getElementById('drop-zone').classList.remove('dragover');
});

listen('tauri://file-drop-hover', () => {
    document.getElementById('drop-zone').classList.add('dragover');
});

listen('tauri://file-drop-cancelled', () => {
    document.getElementById('drop-zone').classList.remove('dragover');
});

async function startConversion(filePath) {
    const apiKey = document.getElementById('api-key').value;
    const modelName = document.getElementById('model-select').value;
    const useAi = document.getElementById('use-ai').checked;
    
    if (useAi && !apiKey) {
        logError("❌ API Key is required for AI Refinement!");
        return;
    }

    // UI Updates
    document.getElementById('progress-container').style.display = 'block';
    document.getElementById('progress-bar').style.width = '10%';
    document.getElementById('raw-md').value = "Processing...";
    document.getElementById('markdown-preview').innerHTML = "Processing...";
    logSystem(`📥 Starting extraction for: ${filePath}`);

    try {
        const resultMarkdown = await invoke('convert_pdf', {
            args: {
                file_path: filePath,
                output_dir: currentOutputDir,
                api_key: apiKey,
                model_name: modelName,
                use_ai: useAi
            }
        });
        
        currentMD = resultMarkdown;
        document.getElementById('raw-md').value = resultMarkdown;
        document.getElementById('markdown-preview').innerHTML = marked.parse(resultMarkdown);
        logSystem("✅ Conversion complete!");
        
    } catch (error) {
        logError(`❌ Conversion failed: ${error}`);
        document.getElementById('raw-md').value = "Error during conversion.";
        document.getElementById('markdown-preview').innerHTML = "Error during conversion.";
    } finally {
        setTimeout(() => {
            document.getElementById('progress-container').style.display = 'none';
            document.getElementById('progress-bar').style.width = '0%';
        }, 1000);
    }
}

// Start
init();
