import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { LiveRedactorTab } from './components/LiveRedactorTab';
import { DocumentMinimizerTab } from './components/DocumentMinimizerTab';
import { FiltersTab } from './components/FiltersTab';
import { BrowserExtensionTab } from './components/BrowserExtensionTab';
import { ModelGatewayTab } from './components/ModelGatewayTab';
import { TokenVaultModal } from './components/TokenVaultModal';
import { DEFAULT_PII_FILTERS } from './lib/defaultFilters';
import { MaskingStrategy, PIIFilterRule } from './types/privacy';
import { CustomRule } from './lib/piiEngine';
import { downloadExtensionZip } from './lib/extensionExporter';
import { ShieldCheck, Lock, ExternalLink } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('redactor');
  const [filters, setFilters] = useState<PIIFilterRule[]>(DEFAULT_PII_FILTERS);
  const [maskingStrategy, setMaskingStrategy] = useState<MaskingStrategy>('TAG_TOKENS');
  const [customRules, setCustomRules] = useState<CustomRule[]>([
    {
      id: 'rule-emp-id',
      name: 'Employee Badge ID',
      pattern: '\\bEMP-\\d{5}\\b',
      category: 'CUSTOM',
      enabled: true,
    },
    {
      id: 'rule-project-code',
      name: 'Internal Project Codename',
      pattern: '\\bProject\\s+(?:Chimera|Omega|Valkyrie|Aegis)\\b',
      category: 'CUSTOM',
      enabled: true,
    },
  ]);
  const [customKeywords, setCustomKeywords] = useState<string[]>([
    'Acquisition Omega',
    'ApexSecretKey',
    'Project Chimera',
  ]);

  // Global in-memory cryptographic token vault
  const [globalVault, setGlobalVault] = useState<Record<string, string>>({});
  const [isVaultModalOpen, setIsVaultModalOpen] = useState<boolean>(false);

  const handleUpdateGlobalVault = useCallback(
    (newVault: Record<string, string>) => {
      setGlobalVault((prev) => ({ ...prev, ...newVault }));
    },
    []
  );

  const handleClearVault = () => {
    setGlobalVault({});
    setIsVaultModalOpen(false);
  };

  const handleDownloadExtension = async () => {
    try {
      await downloadExtensionZip(filters);
    } catch (err) {
      console.error('Failed to export extension zip:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Bar Contract (3 zones) */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenVault={() => setIsVaultModalOpen(true)}
        vaultTokenCount={Object.keys(globalVault).length}
        onDownloadExtension={handleDownloadExtension}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {activeTab === 'redactor' && (
          <LiveRedactorTab
            activeFilters={filters}
            maskingStrategy={maskingStrategy}
            setMaskingStrategy={setMaskingStrategy}
            customRules={customRules}
            customKeywords={customKeywords}
            onUpdateGlobalVault={handleUpdateGlobalVault}
          />
        )}

        {activeTab === 'document' && (
          <DocumentMinimizerTab
            activeFilters={filters}
            maskingStrategy={maskingStrategy}
            onUpdateGlobalVault={handleUpdateGlobalVault}
          />
        )}

        {activeTab === 'filters' && (
          <FiltersTab
            filters={filters}
            setFilters={setFilters}
            maskingStrategy={maskingStrategy}
            setMaskingStrategy={setMaskingStrategy}
            customRules={customRules}
            setCustomRules={setCustomRules}
            customKeywords={customKeywords}
            setCustomKeywords={setCustomKeywords}
          />
        )}

        {activeTab === 'extension' && (
          <BrowserExtensionTab activeFilters={filters} />
        )}

        {activeTab === 'gateway' && (
          <ModelGatewayTab
            activeFilters={filters}
            maskingStrategy={maskingStrategy}
            onUpdateGlobalVault={handleUpdateGlobalVault}
          />
        )}
      </main>

      {/* Token Vault Modal */}
      <TokenVaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        vaultMapping={globalVault}
        onClearVault={handleClearVault}
      />

      {/* Quiet Footer adhering to anti-slop rules */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>AegisPrivacy Data Shield</span>
            <span aria-hidden="true">·</span>
            <span>Client-Side Zero-Knowledge Cryptographic Vault</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setActiveTab('extension')}
              className="hover:text-slate-200 transition-colors"
            >
              Browser Extension
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setActiveTab('filters')}
              className="hover:text-slate-200 transition-colors"
            >
              Filters Configuration
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => setActiveTab('gateway')}
              className="hover:text-slate-200 transition-colors"
            >
              Model Audit
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
