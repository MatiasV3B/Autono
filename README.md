# Antigravity Agent

<div align="center">
  <h3>⚡ AI-Powered Browser Agent & Navigation Copilot</h3>
  <p>
    <img src="https://img.shields.io/badge/Chrome_Extension-Manifest_V3-blue?style=for-the-badge" alt="Manifest V3" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
    <img src="https://img.shields.io/badge/Contributions-Welcome-orange?style=for-the-badge" alt="Contributions Welcome" />
  </p>
</div>

Antigravity Agent is an AI-powered browser extension and copilot featuring Chat and Cowork modes. Built on vanilla JavaScript with Manifest V3, it seamlessly connects to the **Antigravity Bridge** (a local FastAPI server) to interface with advanced AI models like Gemini 3.8/3.7/3.6 Flash, Gemini 3.1 Pro, Claude Sonnet/Opus 4.6, and GPT-OSS 120B.

## ✨ Features

- **Chat Mode**: Fast Q&A with real-time page context extraction (zero DOM mutations).
- **Cowork Mode**: Autonomous browser agent that can click, type, and navigate for you.
- **Rich UI**: Side panel with floating paths, border beams, gradient meshes, and KaTeX math rendering.
- **Shadow Mode**: Keeps the system awake, scheduled alarms, and power management.
- **BTW Assistant**: A smart sidecar assistant ready to assist.
- **Additional Tools**: 
  - Scratchpad and Speech-to-Text
  - DOM extraction & page analysis
  - Screenshot capture & context menus
  - Tab grouping & working overlay
  - Web search via TinyFish SDK
  - MCP server integration and External Provider support
- **Keyboard Shortcuts**: E.g., hit `Alt+Shift+C` to quickly open the side panel.

## 🏗️ Architecture

```mermaid
flowchart LR
    A[Antigravity Agent\n(Chrome Extension)] <-->|HTTP/REST| B[Antigravity Bridge\n(Local FastAPI)]
    B <-->|API Calls| C[AI Models\n(Gemini, Claude, GPT)]
```

## 🚀 Quick Install

### Prerequisites
- Google Chrome 120+
- **Antigravity Bridge** server running locally at `http://127.0.0.1:8000`.

### Installation Steps
1. Clone this repository to your local machine:
   ```bash
   git clone https://github.com/yourusername/antigravity-extension.git
   ```
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer Mode** using the toggle in the top right corner.
4. Click **Load Unpacked** and select the `Antigravity Agent` folder from the cloned repository.

### Configuration
You can configure the extension via the settings menu in the side panel:
- **Bridge URL**: Set to `http://127.0.0.1:8000` (or your custom bridge URL).
- **Model Selection**: Choose your preferred model (e.g., Gemini Flash, Claude Sonnet).
- **TinyFish Key**: Add your TinyFish API key for web search capabilities.

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+C` | Toggle Side Panel |
| *(More shortcuts customizable in `chrome://extensions/shortcuts`)* |

## 📁 Project Structure

```text
Antigravity Extension/
├── Antigravity Agent/       # Main Chrome Extension source (Manifest V3)
│   ├── assets/              # Icons and images
│   ├── components/          # UI components (vanilla JS)
│   ├── lib/                 # Shared libraries (e.g., TinyFish SDK)
│   ├── scripts/             # Build and utility scripts
│   ├── side-panel/          # Side panel HTML/JS/CSS
│   ├── background.js        # Service worker
│   └── manifest.json        # Extension manifest
├── .github/                 # GitHub templates and workflows
├── .env.example             # Environment variable template
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── SECURITY.md
```

## 🛠️ Tech Stack

- **Extension**: Vanilla JavaScript, Chrome Manifest V3, HTML/CSS
- **Libraries**: marked.js (Markdown), KaTeX (Math)
- **Backend/Bridge**: Python, FastAPI

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more details on how to get started.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
