import React from 'react';
import { X, Lock, Download, Trash2, ShieldCheck, Copy, Check } from 'lucide-react';

interface TokenVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultMapping: Record<string, string>; // replacement -> original
  onClearVault: () => void;
}

export const TokenVaultModal: React.FC<TokenVaultModalProps> = ({
  isOpen,
  onClose,
  vaultMapping,
  onClearVault,
}) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const entries = Object.entries(vaultMapping);

  const handleCopy = (key: string, val: string) => {
    navigator.clipboard.writeText(`${key} => ${val}`);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(vaultMapping, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AegisPrivacy-Token-Vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Client-Side Token Vault
              </h3>
              <p className="text-xs text-slate-400">
                Deterministic token-to-entity mappings stored strictly in browser memory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span>Total Active Mappings: <strong className="text-white font-mono tabular-nums">{entries.length}</strong></span>
            <span>Security Guarantee: <span className="text-emerald-400 font-medium">Never Sent Over Wire</span></span>
          </div>

          {entries.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <ShieldCheck className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
              <p className="text-sm font-medium text-slate-400">No tokens generated in this session yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Redact a prompt in the Live Redactor or process a document to inspect cryptographic tokens here.
              </p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60">
              <div className="grid grid-cols-12 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-slate-400 border-b border-slate-800">
                <div className="col-span-5">Anonymized Token (Sent to AI)</div>
                <div className="col-span-5">Original Entity (Kept Local)</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              <div className="divide-y divide-slate-800/80 max-h-80 overflow-y-auto font-mono text-xs">
                {entries.map(([token, original]) => (
                  <div
                    key={token}
                    className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-slate-900/50 transition-colors text-slate-300"
                  >
                    <div className="col-span-5 text-indigo-400 font-medium truncate pr-2">
                      {token}
                    </div>
                    <div className="col-span-5 text-slate-200 truncate pr-2">
                      {original}
                    </div>
                    <div className="col-span-2 text-right">
                      <button
                        onClick={() => handleCopy(token, original)}
                        className="p-1 hover:text-white text-slate-400 transition-colors rounded hover:bg-slate-800 inline-flex items-center"
                        title="Copy pair"
                      >
                        {copiedKey === token ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-slate-950 border border-slate-800/90 rounded-lg text-xs text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-300">De-Anonymization Mechanism:</span> When the third-party model finishes generating its answer containing tokens like <code className="text-indigo-300">[PERSON_1]</code>, AegisPrivacy uses this local dictionary to instantly restore real names in your client without the model ever having seen the true identities.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/50">
          <button
            onClick={onClearVault}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge Vault</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
