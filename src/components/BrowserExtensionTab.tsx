import React, { useState } from 'react';
import {
  Download,
  ShieldCheck,
  Code2,
  Copy,
  Check,
  Globe,
  ExternalLink,
  Laptop,
  Sparkles,
  Zap,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { PIIFilterRule } from '../types/privacy';
import {
  buildExtensionFiles,
  downloadExtensionZip,
  ExtensionFile,
} from '../lib/extensionExporter';
import { redactText, deAnonymizeText } from '../lib/piiEngine';

interface BrowserExtensionTabProps {
  activeFilters: PIIFilterRule[];
}

export const BrowserExtensionTab: React.FC<BrowserExtensionTabProps> = ({
  activeFilters,
}) => {
  const [downloading, setDownloading] = useState<boolean>(false);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // File viewer state
  const extensionFiles = buildExtensionFiles(activeFilters);
  const [selectedFile, setSelectedFile] = useState<ExtensionFile>(extensionFiles[0]);

  // Web Tool Simulator state
  const [simulatedPlatform, setSimulatedPlatform] = useState<'ChatGPT' | 'Claude' | 'Gemini'>('ChatGPT');
  const [simulatedPrompt, setSimulatedPrompt] = useState<string>(
    'Please summarize the contract dispute for client Marcus Vance (m.vance@apex-global.com, +1 415-890-1234) and draft an initial response.'
  );
  const [simulatedSanitized, setSimulatedSanitized] = useState<string | null>(null);
  const [simulatedResponse, setSimulatedResponse] = useState<string | null>(null);
  const [simulatedVault, setSimulatedVault] = useState<Record<string, string>>({});
  const [isDeAnonymizedActive, setIsDeAnonymizedActive] = useState<boolean>(true);

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      await downloadExtensionZip(activeFilters);
    } catch (err) {
      console.error('Failed to download extension package:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyCode = (content: string, name: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(name);
    setTimeout(() => setCopiedFile(null), 1800);
  };

  // Run in-page simulator action
  const handleSimulateSanitize = () => {
    const res = redactText(simulatedPrompt, activeFilters, 'TAG_TOKENS');
    setSimulatedSanitized(res.sanitizedText);
    setSimulatedVault(res.vaultMapping);

    // Mock AI response with tokens
    const rawAiResponse = `I have reviewed the matter for ${res.vaultMapping['[NAME_1]'] ? '[NAME_1]' : 'the client'}.
Key Recommendations:
1. Review the mutual non-disclosure agreement stipulations.
2. Direct all inquiries through legal counsel or secure channel (${res.vaultMapping['[EMAIL_1]'] ? '[EMAIL_1]' : 'verified email'}).
3. Prepare a status declaration before the end of the current billing cycle.`;

    setSimulatedResponse(rawAiResponse);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Browser Extension Integration & Export Hub</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Intercept and anonymize prompts directly inside ChatGPT, Claude, and Gemini web interfaces before transmission.
          </p>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{downloading ? 'Packing Zip...' : 'Download WebExtension (.zip)'}</span>
        </button>
      </div>

      {/* Simulator Section: Interactive Web Tool Interception */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              <span>Interactive In-Browser Interception Simulator</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Experience how the Aegis Floating Shield overlays on web AI interfaces to redact data before it leaves the browser.
            </p>
          </div>

          {/* Platform Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
            {(['ChatGPT', 'Claude', 'Gemini'] as const).map((platform) => (
              <button
                key={platform}
                onClick={() => {
                  setSimulatedPlatform(platform);
                  setSimulatedSanitized(null);
                  setSimulatedResponse(null);
                }}
                className={`px-3 py-1 font-medium rounded-md transition-colors ${
                  simulatedPlatform === platform
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {platform}
              </button>
            ))}
          </div>
        </div>

        {/* Mock Browser Frame */}
        <div className="border border-slate-800 rounded-xl bg-slate-950/90 overflow-hidden shadow-2xl">
          {/* Mock Browser URL Bar */}
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
            </div>
            <div className="flex-1 max-w-md bg-slate-950 px-3 py-1 rounded text-slate-400 font-mono text-[11px] truncate flex items-center gap-1.5 border border-slate-800">
              <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>
                {simulatedPlatform === 'ChatGPT' && 'https://chatgpt.com/c/incident-review'}
                {simulatedPlatform === 'Claude' && 'https://claude.ai/chat/project-analysis'}
                {simulatedPlatform === 'Gemini' && 'https://gemini.google.com/app'}
              </span>
            </div>
          </div>

          {/* Mock In-Page Chat Area */}
          <div className="p-6 space-y-5 min-h-[300px]">
            {/* If simulated response exists */}
            {simulatedResponse && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
                  <span className="text-slate-400 font-medium">
                    {simulatedPlatform} Assistant:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">De-Anonymization View:</span>
                    <button
                      onClick={() => setIsDeAnonymizedActive(!isDeAnonymizedActive)}
                      className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors"
                    >
                      {isDeAnonymizedActive ? 'Restored Real Text' : 'Raw Anonymized Tokens'}
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-lg text-xs font-mono leading-relaxed text-slate-200 whitespace-pre-wrap">
                  {isDeAnonymizedActive
                    ? deAnonymizeText(simulatedResponse, simulatedVault)
                    : simulatedResponse}
                </div>
              </div>
            )}

            {/* Prompt Input Box with Floating Aegis Shield */}
            <div className="relative pt-4">
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Simulated {simulatedPlatform} Chat Prompt Input:
              </label>

              <div className="relative">
                <textarea
                  value={simulatedSanitized !== null ? simulatedSanitized : simulatedPrompt}
                  onChange={(e) => {
                    setSimulatedPrompt(e.target.value);
                    setSimulatedSanitized(null);
                  }}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 pr-32 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed"
                />

                {/* Floating Shield Action Button (Simulates Content Script Badge) */}
                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                  <button
                    onClick={handleSimulateSanitize}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all hover:scale-105 active:scale-95"
                    title="Aegis Browser Extension Shield: Click to Sanitize"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Aegis Sanitize</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
                <span>
                  Shortcut in extension: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Alt + S</kbd> to quick-sanitize input
                </span>
                {simulatedSanitized && (
                  <span className="text-emerald-400 font-medium">
                    ✓ Protected: 0 private fields exposed
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extension Code Inspector & Unpacked Files */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span>Extension Package Source Code Inspector</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect or copy any file included in the downloadable Manifest V3 WebExtension package.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyCode(selectedFile.content, selectedFile.name)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors border border-slate-700/60"
            >
              {copiedFile === selectedFile.name ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy {selectedFile.name}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tabbed file list */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 text-xs">
          {extensionFiles.map((file) => {
            const isSelected = selectedFile.name === file.name;
            return (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file)}
                className={`px-3 py-1.5 rounded-t-lg font-mono font-medium whitespace-nowrap transition-colors border-t border-x ${
                  isSelected
                    ? 'bg-slate-950 text-indigo-400 border-slate-800'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                {file.name}
              </button>
            );
          })}
        </div>

        {/* Code View */}
        <div className="relative bg-slate-950 rounded-lg border border-slate-800 p-4 overflow-x-auto">
          <div className="text-[11px] text-slate-500 mb-2 font-sans">
            File: <span className="text-slate-300 font-mono">{selectedFile.path}</span> — {selectedFile.description}
          </div>
          <pre className="font-mono text-xs leading-relaxed text-slate-200 whitespace-pre overflow-x-auto max-h-[360px]">
            {selectedFile.content}
          </pre>
        </div>
      </div>

      {/* Installation Guide Card */}
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Laptop className="w-4 h-4 text-indigo-400" />
          <span>How to Load Unpacked in Chrome, Edge, or Brave (30 Seconds)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
            <span className="font-semibold text-indigo-400">Step 1: Download & Unzip</span>
            <p className="text-slate-400 leading-relaxed">
              Click &quot;Download WebExtension (.zip)&quot; above and extract the archive into any local folder on your computer.
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
            <span className="font-semibold text-indigo-400">Step 2: Enable Developer Mode</span>
            <p className="text-slate-400 leading-relaxed">
              In Chrome or Edge, navigate to <code className="text-slate-300 font-mono">chrome://extensions</code> and switch on the &quot;Developer mode&quot; toggle at top-right.
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
            <span className="font-semibold text-indigo-400">Step 3: Click &quot;Load Unpacked&quot;</span>
            <p className="text-slate-400 leading-relaxed">
              Select the unzipped folder containing <code className="text-slate-300 font-mono">manifest.json</code>. The Aegis Shield will immediately activate across all AI tools!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
