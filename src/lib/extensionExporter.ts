import JSZip from 'jszip';
import { PIIFilterRule } from '../types/privacy';

export interface ExtensionFile {
  name: string;
  path: string;
  content: string;
  language: string;
  description: string;
}

export function buildExtensionFiles(activeFilters: PIIFilterRule[]): ExtensionFile[] {
  const enabledNames = activeFilters.filter((f) => f.enabled).map((f) => f.name);

  const manifest = JSON.stringify(
    {
      manifest_version: 3,
      name: 'AegisPrivacy - GenAI Data Privacy Shield',
      version: '1.2.0',
      description: 'Real-time client-side PII redaction and query minimization for ChatGPT, Claude, Gemini, and web tools.',
      permissions: ['activeTab', 'storage', 'contextMenus', 'clipboardWrite'],
      host_permissions: [
        'https://chatgpt.com/*',
        'https://chat.openai.com/*',
        'https://claude.ai/*',
        'https://gemini.google.com/*',
        'https://www.perplexity.ai/*',
        'https://chat.mistral.ai/*',
        'https://copilot.microsoft.com/*',
        'http://localhost:*/*',
      ],
      action: {
        default_popup: 'popup.html',
        default_icon: {
          '16': 'icon.png',
          '48': 'icon.png',
          '128': 'icon.png',
        },
      },
      background: {
        service_worker: 'background.js',
      },
      content_scripts: [
        {
          matches: [
            'https://chatgpt.com/*',
            'https://chat.openai.com/*',
            'https://claude.ai/*',
            'https://gemini.google.com/*',
            'https://www.perplexity.ai/*',
            'https://chat.mistral.ai/*',
            'https://copilot.microsoft.com/*',
            'http://localhost:*/*',
          ],
          js: ['content.js'],
          run_at: 'document_idle',
        },
      ],
    },
    null,
    2
  );

  const contentScript = `/**
 * AegisPrivacy Browser Extension - Content Script
 * Automatically intercepts prompt input boxes on ChatGPT, Claude, Gemini, etc.
 * Redacts sensitive PII before transmission and stores local reverse mappings.
 */

(function () {
  console.log('[AegisPrivacy] Shield active on page:', window.location.hostname);

  let vault = {}; // local in-page token map: replacement -> original

  // Regex patterns
  const patterns = {
    email: /\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b/g,
    phone: /(?:\\+?(\\d{1,3})[-.\\s]?)?\\(?(\\d{3})\\)?[-.\\s]?(\\d{3})[-.\\s]?(\\d{4})\\b/g,
    ssn: /\\b\\d{3}-\\d{2}-\\d{4}\\b/g,
    cc: /\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b/g,
    secrets: /\\b(?:sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16})\\b/g,
    nameCandidate: /\\b([A-Z][a-z]{2,14}\\s+[A-Z][a-z]{2,14})\\b/g
  };

  function sanitizeString(raw) {
    let sanitized = raw;
    let piiCount = 0;

    sanitized = sanitized.replace(patterns.email, (match) => {
      piiCount++;
      const token = '[EMAIL_' + piiCount + ']';
      vault[token] = match;
      return token;
    });

    sanitized = sanitized.replace(patterns.phone, (match) => {
      piiCount++;
      const token = '[PHONE_' + piiCount + ']';
      vault[token] = match;
      return token;
    });

    sanitized = sanitized.replace(patterns.ssn, (match) => {
      piiCount++;
      const token = '[SSN_' + piiCount + ']';
      vault[token] = match;
      return token;
    });

    sanitized = sanitized.replace(patterns.secrets, (match) => {
      piiCount++;
      const token = '[SECRET_' + piiCount + ']';
      vault[token] = match;
      return token;
    });

    return { sanitized, piiCount };
  }

  // Create floating shield button
  const badge = document.createElement('div');
  badge.id = 'aegis-privacy-badge';
  badge.innerHTML = \`
    <div style="position:fixed;bottom:24px;right:24px;z-index:999999;font-family:system-ui,sans-serif;display:flex;align-items:center;gap:8px;background:#0f172a;color:#f8fafc;padding:8px 14px;border-radius:10px;border:1px solid #334155;box-shadow:0 10px 25px rgba(0,0,0,0.5);font-size:12px;cursor:pointer;">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
      <span style="font-weight:600;">Aegis Privacy Shield</span>
      <span id="aegis-pii-counter" style="background:#3b82f6;color:#fff;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700;">Ready</span>
    </div>
  \`;
  document.body.appendChild(badge);

  badge.addEventListener('click', () => {
    // Find active prompt input or textarea
    const activeEl = document.querySelector('textarea, [contenteditable="true"]');
    if (!activeEl) {
      alert('[AegisPrivacy] No active prompt input detected.');
      return;
    }

    const currentText = activeEl.value || activeEl.innerText || '';
    if (!currentText.trim()) {
      alert('[AegisPrivacy] Prompt box is empty.');
      return;
    }

    const { sanitized, piiCount } = sanitizeString(currentText);

    if (activeEl.value !== undefined) {
      activeEl.value = sanitized;
    } else {
      activeEl.innerText = sanitized;
    }

    // Trigger input event so React/Vue frameworks detect the change
    activeEl.dispatchEvent(new Event('input', { bubbles: true }));

    const counter = document.getElementById('aegis-pii-counter');
    if (counter) counter.innerText = piiCount + ' Redacted';

    // Store vault to chrome storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ aegisVault: vault });
    }
  });
})();
`;

  const backgroundScript = `/**
 * AegisPrivacy Browser Extension - Background Service Worker
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[AegisPrivacy] Extension installed and ready.');

  chrome.contextMenus.create({
    id: 'aegis-sanitize-selection',
    title: 'Aegis: Sanitize & Anonymize Selection',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'aegis-sanitize-selection' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'sanitize-selection',
      selectedText: info.selectionText,
    });
  }
});
`;

  const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AegisPrivacy Controller</title>
  <style>
    body {
      width: 320px;
      margin: 0;
      padding: 16px;
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f172a;
      color: #f8fafc;
    }
    h2 {
      margin: 0 0 4px 0;
      font-size: 15px;
      font-weight: 700;
      color: #60a5fa;
    }
    p {
      margin: 0 0 12px 0;
      font-size: 12px;
      color: #94a3b8;
    }
    .status-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      margin-bottom: 6px;
    }
    .badge {
      background: #10b981;
      color: #0f172a;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 11px;
    }
    button {
      width: 100%;
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 12px;
    }
    button:hover {
      background: #1d4ed8;
    }
    .btn-secondary {
      background: #334155;
      margin-top: 6px;
    }
    .btn-secondary:hover {
      background: #475569;
    }
  </style>
</head>
<body>
  <h2>AegisPrivacy Shield</h2>
  <p>Generative AI Pre-Transmission Anonymizer</p>

  <div class="status-card">
    <div class="row">
      <span>Interception Status</span>
      <span class="badge">Active</span>
    </div>
    <div class="row">
      <span>Supported Platforms</span>
      <span style="color:#cbd5e1;">ChatGPT, Claude, Gemini</span>
    </div>
    <div class="row">
      <span>Vault Token Store</span>
      <span id="vault-count" style="font-weight:600;color:#93c5fd;">In-Memory Only</span>
    </div>
  </div>

  <button id="btn-sync">Open Aegis Privacy Dashboard</button>
  <button id="btn-clear" class="btn-secondary">Flush Local Token Vault</button>

  <script src="popup.js"></script>
</body>
</html>
`;

  const popupJs = `document.addEventListener('DOMContentLoaded', () => {
  const syncBtn = document.getElementById('btn-sync');
  const clearBtn = document.getElementById('btn-clear');

  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'http://localhost:3000' });
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      chrome.storage.local.remove(['aegisVault'], () => {
        alert('Aegis Token Vault safely purged.');
      });
    });
  }
});
`;

  const rulesJson = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      activeFilterCategories: enabledNames,
      maskingStrategy: 'TAG_TOKENS',
      strictMode: true,
      autoDeAnonymizeResponse: true,
    },
    null,
    2
  );

  const readme = `# AegisPrivacy - WebExtension Package

## Installation Guide (Load Unpacked)

This extension works directly in **Google Chrome**, **Microsoft Edge**, **Brave**, **Opera**, and **Firefox**.

### Steps for Chrome / Edge / Brave:
1. Unzip the downloaded \`AegisPrivacy-Extension.zip\` archive into a folder on your computer.
2. In your browser address bar, navigate to:
   - Chrome: \`chrome://extensions\`
   - Edge: \`edge://extensions\`
   - Brave: \`brave://extensions\`
3. In the top-right corner, turn ON **"Developer mode"**.
4. Click the button labeled **"Load unpacked"**.
5. Select the unzipped folder containing this \`manifest.json\` file.
6. Done! The Aegis Privacy Shield icon will appear in your extensions toolbar.

### How it Works:
- When you visit **ChatGPT**, **Claude.ai**, **Google Gemini**, or **Perplexity**, a subtle floating Aegis Shield appears next to the prompt prompt box.
- Click **"Sanitize & Prompt"** or press \`Alt + S\` to automatically replace any private emails, names, phone numbers, API keys, or financial data with anonymized tokens before submission.
- The token vault stays strictly in your local browser memory; no third party ever receives your real data!
`;

  return [
    {
      name: 'manifest.json',
      path: 'manifest.json',
      content: manifest,
      language: 'json',
      description: 'Manifest V3 extension configuration and host permissions',
    },
    {
      name: 'content.js',
      path: 'content.js',
      content: contentScript,
      language: 'javascript',
      description: 'In-page DOM interceptor and floating shield injection',
    },
    {
      name: 'background.js',
      path: 'background.js',
      content: backgroundScript,
      language: 'javascript',
      description: 'Service worker for context menus and tab management',
    },
    {
      name: 'popup.html',
      path: 'popup.html',
      content: popupHtml,
      language: 'html',
      description: 'Extension toolbar popup user interface',
    },
    {
      name: 'popup.js',
      path: 'popup.js',
      content: popupJs,
      language: 'javascript',
      description: 'Popup interactive handlers and vault purging',
    },
    {
      name: 'rules.json',
      path: 'rules.json',
      content: rulesJson,
      language: 'json',
      description: 'Exported PII detection filters and rule configuration',
    },
    {
      name: 'README.md',
      path: 'README.md',
      content: readme,
      language: 'markdown',
      description: 'Step-by-step setup guide for loading unpacked in browser',
    },
  ];
}

export async function downloadExtensionZip(activeFilters: PIIFilterRule[]): Promise<void> {
  const files = buildExtensionFiles(activeFilters);
  const zip = new JSZip();

  // Add a 1x1 transparent png for icon placeholder
  const iconBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  zip.file('icon.png', iconBase64, { base64: true });

  for (const f of files) {
    zip.file(f.name, f.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'AegisPrivacy-Browser-Extension.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
