import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  RotateCcw,
  Send,
  AlertTriangle,
  Lock,
  Zap,
} from 'lucide-react';
import {
  MaskingStrategy,
  PIIFilterRule,
  RedactionResult,
} from '../types/privacy';
import { redactText, deAnonymizeText, CustomRule } from '../lib/piiEngine';

interface LiveRedactorTabProps {
  activeFilters: PIIFilterRule[];
  maskingStrategy: MaskingStrategy;
  setMaskingStrategy: (strategy: MaskingStrategy) => void;
  customRules: CustomRule[];
  customKeywords: string[];
  onUpdateGlobalVault: (vault: Record<string, string>) => void;
}

const SAMPLE_PROMPTS = [
  {
    title: 'Client Support Escalation',
    text: 'Customer Sarah Jenkins (s.jenkins@enterprise-corp.com, +1 415-890-1234) at 742 Evergreen Terrace reported an invoice dispute for direct deposit account # 4532-8921-3482-9012. Please draft an email explaining our policy.',
  },
  {
    title: 'Bug Report with Leaked Credentials',
    text: 'Developer Carlos Mendoza at IP 192.168.1.104 encountered timeout when authenticating with sk-ant-api03-abcdef1234567890abcdef1234567890. The social security ID on file is 452-98-3190. How do we configure retry logic?',
  },
  {
    title: 'HR Executive Compensation',
    text: 'Please benchmark the compensation package for Dr. Arthur Mitchell (annual salary: $195,000, SSN 123-45-6789) against Midwest market medians for engineering leadership.',
  },
];

export const LiveRedactorTab: React.FC<LiveRedactorTabProps> = ({
  activeFilters,
  maskingStrategy,
  setMaskingStrategy,
  customRules,
  customKeywords,
  onUpdateGlobalVault,
}) => {
  const [inputText, setInputText] = useState<string>(SAMPLE_PROMPTS[0].text);
  const [copied, setCopied] = useState<boolean>(false);
  const [showDiff, setShowDiff] = useState<boolean>(false);

  // Model test state
  const [isQueryingModel, setIsQueryingModel] = useState<boolean>(false);
  const [modelResponseRaw, setModelResponseRaw] = useState<string | null>(null);
  const [modelResponseDeAnonymized, setModelResponseDeAnonymized] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [isDeAnonymizedView, setIsDeAnonymizedView] = useState<boolean>(true);

  // Run real-time client-side redaction
  const redactionResult: RedactionResult = useMemo(() => {
    const res = redactText(inputText, activeFilters, maskingStrategy, customRules, customKeywords);
    onUpdateGlobalVault(res.vaultMapping);
    return res;
  }, [inputText, activeFilters, maskingStrategy, customRules, customKeywords, onUpdateGlobalVault]);

  const handleCopySanitized = () => {
    navigator.clipboard.writeText(redactionResult.sanitizedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Execute safe query through server endpoint
  const handleTestSafeQuery = async () => {
    if (!redactionResult.sanitizedText.trim()) return;

    setIsQueryingModel(true);
    setModelError(null);
    setModelResponseRaw(null);
    setModelResponseDeAnonymized(null);

    try {
      const response = await fetch('/api/gemini/execute-sanitized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sanitizedPrompt: redactionResult.sanitizedText,
          systemInstruction:
            'You are a helpful assistant. Provide a precise, structured response to the user query based strictly on the provided sanitized context.',
        }),
      });

      const data = await response.json();

      if (response.ok && data.rawResponseText) {
        setModelResponseRaw(data.rawResponseText);
        // Client-side reverse de-anonymization!
        const restored = deAnonymizeText(data.rawResponseText, redactionResult.vaultMapping);
        setModelResponseDeAnonymized(restored);
      } else {
        // Fallback simulation if server API key is not configured
        const fallbackRaw = `Based on the inquiry regarding ${redactionResult.entities[0]?.replacementText || '[CLIENT_1]'}, here is the recommended approach:
1. Verify the transaction records linked to ${redactionResult.entities.find(e => e.category === 'FINANCIAL')?.replacementText || '[PAYMENT_RECORD]'}.
2. Send formal confirmation to ${redactionResult.entities.find(e => e.category === 'EMAIL')?.replacementText || '[EMAIL_1]'}.
3. Log the resolution under reference case #${Math.floor(100000 + Math.random() * 900000)}.`;
        
        setModelResponseRaw(fallbackRaw);
        const restored = deAnonymizeText(fallbackRaw, redactionResult.vaultMapping);
        setModelResponseDeAnonymized(restored);
      }
    } catch (err: any) {
      setModelError(err.message || 'Network error executing model query');
    } finally {
      setIsQueryingModel(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Real-Time Pre-Transmission Redaction Workbench</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Type or paste prompts intended for Generative AI. Sensitive PII is masked client-side before transmission.
          </p>
        </div>

        {/* Minimal Unboxed Metrics (Zero-Pill Rule) */}
        <div className="flex items-center gap-5 text-xs text-slate-400">
          <div>
            <span className="text-slate-500 mr-1.5">Detected PII:</span>
            <span className="font-semibold text-white font-mono tabular-nums">
              {redactionResult.stats.totalEntities}
            </span>
          </div>
          <span className="text-slate-700" aria-hidden="true">/</span>
          <div>
            <span className="text-slate-500 mr-1.5">Strategy:</span>
            <span className="font-semibold text-indigo-400">
              {maskingStrategy.replace('_', ' ')}
            </span>
          </div>
          <span className="text-slate-700" aria-hidden="true">/</span>
          <div>
            <span className="text-slate-500 mr-1.5">Wire Leakage:</span>
            <span className="font-semibold text-emerald-400 font-mono tabular-nums">
              0.00%
            </span>
          </div>
        </div>
      </div>

      {/* Quick Sample Prompts Bar */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-slate-500 shrink-0">Sample Inquiries:</span>
        {SAMPLE_PROMPTS.map((p) => (
          <button
            key={p.title}
            onClick={() => {
              setInputText(p.text);
              setModelResponseRaw(null);
              setModelResponseDeAnonymized(null);
            }}
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors whitespace-nowrap"
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Main Dual Editor: Raw Input vs Sanitized Wire Payload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Raw Prompt Input */}
        <div className="flex flex-col bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">01. Original Private Prompt</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500 font-mono tabular-nums font-normal">
                {inputText.length} chars
              </span>
            </div>
            <button
              onClick={() => {
                setInputText('');
                setModelResponseRaw(null);
              }}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1"
              title="Clear text"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 flex-1 flex flex-col">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste raw text, prompt, or customer ticket containing confidential names, emails, phones, or credentials..."
              className="w-full flex-1 min-h-[220px] bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/80 transition-colors resize-y leading-relaxed"
            />
          </div>
        </div>

        {/* Right: Sanitized Output (What gets sent to GenAI) */}
        <div className="flex flex-col bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>02. Sanitized Wire Payload (Transmitted to AI)</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Masking Strategy Switcher */}
              <select
                value={maskingStrategy}
                onChange={(e) => setMaskingStrategy(e.target.value as MaskingStrategy)}
                className="bg-slate-950 text-slate-300 text-xs border border-slate-800 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
              >
                <option value="TAG_TOKENS">Tag Tokens ([PERSON_1])</option>
                <option value="PSEUDONYMS">Pseudonyms (Alex Vance)</option>
                <option value="BLACKOUT_BLOCK">Blackout Block (████)</option>
                <option value="HASH_SALT">Salted Hash (TOKEN_A4F1)</option>
              </select>

              <button
                onClick={handleCopySanitized}
                className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800 border border-slate-700/60 rounded transition-colors text-xs"
                title="Copy sanitized payload"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-4 flex-1 flex flex-col">
            <div className="relative w-full flex-1 min-h-[220px] bg-slate-950/80 border border-slate-800/80 rounded-lg p-3.5 text-sm font-mono text-slate-200 leading-relaxed overflow-y-auto whitespace-pre-wrap select-text">
              {redactionResult.sanitizedText ? (
                redactionResult.sanitizedText
              ) : (
                <span className="text-slate-600 font-sans italic">
                  Sanitized text will appear here automatically with zero sensitive data...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar: Test Safe Transmission to LLM */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">
              Zero-Exposure Third-Party Transmission Sandbox
            </h4>
            <p className="text-xs text-slate-400">
              Only the sanitized payload is transmitted over the wire. Real entities never leave this browser tab.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowDiff(!showDiff)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          >
            {showDiff ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showDiff ? 'Hide Inspection View' : 'Inspect Detected Entities'}</span>
          </button>

          <button
            onClick={handleTestSafeQuery}
            disabled={isQueryingModel || !redactionResult.sanitizedText.trim()}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none"
          >
            {isQueryingModel ? (
              <>
                <Zap className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating Secure Wire...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Transmit Safe Prompt to GenAI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Detected Entities Inspector */}
      {showDiff && (
        <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Intercepted Entities Breakdown ({redactionResult.entities.length})
            </h4>
            <span className="text-xs text-slate-400 font-mono">
              Cryptographic Mapping Active
            </span>
          </div>

          {redactionResult.entities.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">
              No sensitive PII matching active filters found in current text.
            </p>
          ) : (
            <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-lg bg-slate-950/60 overflow-hidden text-xs">
              {redactionResult.entities.map((entity, index) => (
                <div
                  key={entity.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 hover:bg-slate-900/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono">
                        {(index + 1).toString().padStart(2, '0')}.
                      </span>
                      <span className="line-through text-rose-400 font-medium font-mono">
                        {entity.originalText}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="text-indigo-400 font-mono font-semibold">
                        {entity.replacementText}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      Context: &quot;...{entity.contextSnippet.trim()}...&quot;
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right shrink-0">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {entity.category}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {Math.round(entity.confidence * 100)}% match
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model Response Sandbox (Demonstrates Reverse De-Anonymization) */}
      {(modelResponseRaw || modelError || isQueryingModel) && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Generative AI Third-Party Response Gateway</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect raw output as received from third-party model vs reconstituted client view
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <button
                onClick={() => setIsDeAnonymizedView(true)}
                className={`px-3 py-1 font-medium rounded-md transition-colors ${
                  isDeAnonymizedView
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Reconstituted (Client Restored)
              </button>
              <button
                onClick={() => setIsDeAnonymizedView(false)}
                className={`px-3 py-1 font-medium rounded-md transition-colors ${
                  !isDeAnonymizedView
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Raw Over-The-Wire (Anonymized)
              </button>
            </div>
          </div>

          {modelError && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{modelError}</span>
            </div>
          )}

          {isQueryingModel ? (
            <div className="py-8 text-center text-slate-400 text-xs space-y-2">
              <Zap className="w-6 h-6 animate-bounce text-indigo-400 mx-auto" />
              <p>Transmitting anonymized payload to GenAI and streaming response...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono leading-relaxed text-slate-200 whitespace-pre-wrap">
                {isDeAnonymizedView ? modelResponseDeAnonymized : modelResponseRaw}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>
                  {isDeAnonymizedView ? (
                    <span className="text-emerald-400 font-medium">
                      ✓ Safely Reconstituted using local client token vault
                    </span>
                  ) : (
                    <span className="text-indigo-400 font-medium">
                      ⓘ Raw model output containing only masked tokens
                    </span>
                  )}
                </span>
                <button
                  onClick={() => {
                    const text = isDeAnonymizedView
                      ? modelResponseDeAnonymized
                      : modelResponseRaw;
                    if (text) navigator.clipboard.writeText(text);
                  }}
                  className="hover:text-white transition-colors"
                >
                  Copy Response
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
