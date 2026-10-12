import React from 'react';
import { ShieldCheck, Download, KeyRound } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenVault: () => void;
  vaultTokenCount: number;
  onDownloadExtension: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenVault,
  vaultTokenCount,
  onDownloadExtension,
}) => {
  const navItems = [
    { id: 'redactor', label: 'Live Redactor' },
    { id: 'document', label: 'Document Minimizer' },
    { id: 'filters', label: 'PII Filters' },
    { id: 'extension', label: 'Browser Extension' },
    { id: 'gateway', label: 'Model Gateway' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('redactor');
            }}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap hover:text-indigo-300 transition-colors"
          >
            AegisPrivacy
          </a>
        </div>

        {/* Zone 2: 4-5 concise single-line nav items */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-900/80 border border-slate-800 rounded-lg">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-xs border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action + Vault button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenVault}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap"
            title="Inspect active in-memory token to entity mapping"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Vault</span>
            <span className="font-mono tabular-nums text-slate-400 ml-1">
              ({vaultTokenCount})
            </span>
          </button>

          <button
            onClick={onDownloadExtension}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors whitespace-nowrap shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Get Extension</span>
          </button>
        </div>
      </div>
    </header>
  );
};
