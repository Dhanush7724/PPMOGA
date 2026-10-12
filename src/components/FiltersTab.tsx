import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Code,
  Tag,
  Shield,
  Layers,
  Settings,
} from 'lucide-react';
import {
  MaskingStrategy,
  PIICategory,
  PIIFilterRule,
} from '../types/privacy';
import { CustomRule } from '../lib/piiEngine';

interface FiltersTabProps {
  filters: PIIFilterRule[];
  setFilters: React.Dispatch<React.SetStateAction<PIIFilterRule[]>>;
  maskingStrategy: MaskingStrategy;
  setMaskingStrategy: (strategy: MaskingStrategy) => void;
  customRules: CustomRule[];
  setCustomRules: React.Dispatch<React.SetStateAction<CustomRule[]>>;
  customKeywords: string[];
  setCustomKeywords: React.Dispatch<React.SetStateAction<string[]>>;
}

export const FiltersTab: React.FC<FiltersTabProps> = ({
  filters,
  setFilters,
  maskingStrategy,
  setMaskingStrategy,
  customRules,
  setCustomRules,
  customKeywords,
  setCustomKeywords,
}) => {
  // New custom regex rule inputs
  const [newRuleName, setNewRuleName] = useState<string>('');
  const [newRulePattern, setNewRulePattern] = useState<string>('');
  const [newRuleCategory, setNewRuleCategory] = useState<PIICategory>('CUSTOM');
  const [newKeywordInput, setNewKeywordInput] = useState<string>('');

  const toggleFilter = (id: string) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const updateSensitivity = (id: string, sens: 'HIGH' | 'MEDIUM' | 'LOW') => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, sensitivity: sens } : f))
    );
  };

  const handleAddCustomRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRulePattern.trim()) return;

    try {
      new RegExp(newRulePattern);
    } catch {
      alert('Invalid Regular Expression syntax');
      return;
    }

    const newRule: CustomRule = {
      id: `custom-rule-${Date.now()}`,
      name: newRuleName.trim(),
      pattern: newRulePattern.trim(),
      category: newRuleCategory,
      enabled: true,
    };

    setCustomRules((prev) => [...prev, newRule]);
    setNewRuleName('');
    setNewRulePattern('');
  };

  const handleRemoveCustomRule = (id: string) => {
    setCustomRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const term = newKeywordInput.trim();
    if (!term || customKeywords.includes(term)) return;
    setCustomKeywords((prev) => [...prev, term]);
    setNewKeywordInput('');
  };

  const handleRemoveKeyword = (term: string) => {
    setCustomKeywords((prev) => prev.filter((k) => k !== term));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>PII Detection Policies & Redaction Strategies</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure built-in entity detectors, choose token masking techniques, and define custom enterprise regex rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Total Active Rules:</span>
          <span className="font-mono text-xs font-semibold text-indigo-400">
            {filters.filter((f) => f.enabled).length + customRules.filter((r) => r.enabled).length} Active
          </span>
        </div>
      </div>

      {/* Masking Strategy Selector */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Redaction Masking Strategy</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Determines how intercepted sensitive entities are formatted before transmission to Generative AI.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            {
              id: 'TAG_TOKENS' as MaskingStrategy,
              title: 'Categorical Tag Tokens',
              example: '[PERSON_1], [EMAIL_1]',
              desc: 'Deterministic tokens that maintain clear semantic role for the model while hiding private text.',
            },
            {
              id: 'PSEUDONYMS' as MaskingStrategy,
              title: 'Realistic Pseudonyms',
              example: 'Jordan Cross, Alex Mercer',
              desc: 'Substitutes realistic fictitious names & addresses so the LLM responds naturally without robotic markers.',
            },
            {
              id: 'BLACKOUT_BLOCK' as MaskingStrategy,
              title: 'Solid Blackout Block',
              example: '████████',
              desc: 'Standard visual privacy redaction bar. Ideal when text is exported directly for visual compliance audit.',
            },
            {
              id: 'HASH_SALT' as MaskingStrategy,
              title: 'Salted Token Hash',
              example: 'TOKEN_8F3A2B',
              desc: 'Hexadecimal hashed identifier for zero-knowledge reference across enterprise pipelines.',
            },
          ].map((strat) => {
            const isSelected = maskingStrategy === strat.id;
            return (
              <button
                key={strat.id}
                onClick={() => setMaskingStrategy(strat.id)}
                className={`p-3.5 text-left rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-xs'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-white">
                    {strat.title}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <div className="text-[11px] font-mono text-indigo-300 mb-2">
                  {strat.example}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {strat.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Built-in PII Filters Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Built-In PII Categories & Detectors</span>
        </h3>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-sm">
          <div className="grid grid-cols-12 bg-slate-900 px-5 py-3 text-xs font-semibold text-slate-400 border-b border-slate-800">
            <div className="col-span-1">State</div>
            <div className="col-span-3">Category Name</div>
            <div className="col-span-4">Scope & Description</div>
            <div className="col-span-2">Sensitivity</div>
            <div className="col-span-2 text-right">Examples</div>
          </div>

          <div className="divide-y divide-slate-800/80 text-xs">
            {filters.map((filter) => (
              <div
                key={filter.id}
                className="grid grid-cols-12 px-5 py-3.5 items-center hover:bg-slate-900/40 transition-colors"
              >
                {/* Toggle */}
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={filter.enabled}
                    onChange={() => toggleFilter(filter.id)}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                </div>

                {/* Name */}
                <div className="col-span-3">
                  <div className="font-semibold text-slate-200">
                    {filter.name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {filter.category}
                  </div>
                </div>

                {/* Description */}
                <div className="col-span-4 pr-3 text-slate-400 text-[11px] leading-relaxed">
                  {filter.description}
                </div>

                {/* Sensitivity Selector */}
                <div className="col-span-2">
                  <select
                    value={filter.sensitivity}
                    onChange={(e) =>
                      updateSensitivity(
                        filter.id,
                        e.target.value as 'HIGH' | 'MEDIUM' | 'LOW'
                      )
                    }
                    className="bg-slate-950 text-slate-300 text-xs border border-slate-800 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="HIGH">High (Strict)</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low (Permissive)</option>
                  </select>
                </div>

                {/* Examples */}
                <div className="col-span-2 text-right text-[11px] text-slate-400 font-mono truncate">
                  {filter.examples[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Regular Expression Builder */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Code className="w-4 h-4 text-amber-400" />
            <span>Custom Regex Rules (Proprietary Patterns)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Add custom regular expressions for internal employee badge numbers, confidential project code names, or ERP ticket formats.
          </p>
        </div>

        {/* Add custom rule form */}
        <form
          onSubmit={handleAddCustomRule}
          className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-4 bg-slate-950/70 border border-slate-800 rounded-lg text-xs"
        >
          <div className="md:col-span-4 space-y-1">
            <label className="text-slate-300 font-medium">Rule Name</label>
            <input
              type="text"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              placeholder="e.g. Employee Badge ID"
              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-5 space-y-1">
            <label className="text-slate-300 font-medium">Regex Pattern</label>
            <input
              type="text"
              value={newRulePattern}
              onChange={(e) => setNewRulePattern(e.target.value)}
              placeholder="e.g. \\bEMP-\\d{5}\\b"
              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Rule</span>
            </button>
          </div>
        </form>

        {/* Existing custom rules list */}
        {customRules.length > 0 && (
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-slate-950/50 text-xs">
            {customRules.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 text-slate-300"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-white">{r.name}</span>
                  <span className="text-slate-500 font-mono">
                    Pattern: <code className="text-amber-400">{r.pattern}</code>
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveCustomRule(r.id)}
                  className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sensitive Keywords & Entity Blacklist */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-400" />
            <span>Confidential Keyword & Phrase Blacklist</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Explicit terms that should always be masked regardless of regex format (e.g. confidential client names, internal mergers, secret initiative code names).
          </p>
        </div>

        <form onSubmit={handleAddKeyword} className="flex gap-2 text-xs">
          <input
            type="text"
            value={newKeywordInput}
            onChange={(e) => setNewKeywordInput(e.target.value)}
            placeholder="e.g. Project Chimera, Acquirer Corp, SecretBeta"
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors whitespace-nowrap"
          >
            Add Blacklist Term
          </button>
        </form>

        <div className="flex flex-wrap gap-2 pt-2">
          {customKeywords.length === 0 ? (
            <span className="text-xs text-slate-500 italic">
              No custom terms added yet. Add company names or trade secrets above.
            </span>
          ) : (
            customKeywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-md"
              >
                <span>{kw}</span>
                <button
                  onClick={() => handleRemoveKeyword(kw)}
                  className="text-slate-400 hover:text-rose-400 transition-colors"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
