import React, { useState, useRef, useId } from 'react';
import {
  FileText,
  Upload,
  Download,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Sliders,
  FileCheck,
  Trash2,
  FolderArchive,
  Layers,
  FileUp,
  AlertCircle,
  Eye,
  Plus,
  RefreshCw,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  DocumentMinimizationResult,
  MaskingStrategy,
  PIIFilterRule,
} from '../types/privacy';
import { processDocumentMinimization } from '../lib/documentMinimizer';
import { SAMPLE_DOCUMENTS, SampleDocument } from '../lib/sampleDocuments';

export interface BatchDocumentItem {
  id: string;
  name: string;
  size: number;
  content: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  result?: DocumentMinimizationResult;
  errorMessage?: string;
}

interface DocumentMinimizerTabProps {
  activeFilters: PIIFilterRule[];
  maskingStrategy: MaskingStrategy;
  onUpdateGlobalVault: (vault: Record<string, string>) => void;
}

export const DocumentMinimizerTab: React.FC<DocumentMinimizerTabProps> = ({
  activeFilters,
  maskingStrategy,
  onUpdateGlobalVault,
}) => {
  // Batch documents list
  const [documents, setDocuments] = useState<BatchDocumentItem[]>(() => [
    {
      id: 'doc-initial-hr',
      name: 'Employee-Annual-Review.txt',
      size: SAMPLE_DOCUMENTS[0].content.length,
      content: SAMPLE_DOCUMENTS[0].content,
      status: 'PENDING',
    },
  ]);

  const [selectedDocId, setSelectedDocId] = useState<string>('doc-initial-hr');
  const [queryPrompt, setQueryPrompt] = useState<string>(
    SAMPLE_DOCUMENTS[0].suggestedQuery
  );

  // Processing state
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(0);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Drag-and-drop state
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active view mode for selected document inspector
  const [activeViewMode, setActiveViewMode] = useState<'sanitized' | 'minimized_raw'>('sanitized');
  const [copied, setCopied] = useState<boolean>(false);

  // Helper to read file as text
  const readFileAsText = (file: File): Promise<{ name: string; size: number; content: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          name: file.name,
          size: file.size,
          content: (e.target?.result as string) || '',
        });
      };
      reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
      reader.readAsText(file);
    });
  };

  // Add files to batch queue
  const handleAddFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newDocs: BatchDocumentItem[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const f = fileArray[i];
      try {
        const { name, size, content } = await readFileAsText(f);
        if (content.trim()) {
          newDocs.push({
            id: `doc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
            name,
            size,
            content,
            status: 'PENDING',
          });
        }
      } catch (err) {
        console.error('Error reading file:', err);
      }
    }

    if (newDocs.length > 0) {
      setDocuments((prev) => [...prev, ...newDocs]);
      if (!selectedDocId || !documents.find((d) => d.id === selectedDocId)) {
        setSelectedDocId(newDocs[0].id);
      }
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await handleAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleAddFiles(e.target.files);
      e.target.value = ''; // Reset input so same files can be re-selected if desired
    }
  };

  // Load sample documents into the batch queue
  const handleLoadSampleSuite = () => {
    const sampleItems: BatchDocumentItem[] = SAMPLE_DOCUMENTS.map((doc, idx) => ({
      id: `doc-sample-${doc.id}-${Date.now()}`,
      name: `${doc.id.replace('sample-', '').toUpperCase()}-Report.txt`,
      size: doc.content.length,
      content: doc.content,
      status: 'PENDING',
    }));

    setDocuments((prev) => [...prev, ...sampleItems]);
    setSelectedDocId(sampleItems[0].id);
  };

  // Remove single file
  const handleRemoveDoc = (id: string) => {
    setDocuments((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      if (selectedDocId === id && updated.length > 0) {
        setSelectedDocId(updated[0].id);
      }
      return updated;
    });
  };

  // Clear all
  const handleClearAllDocs = () => {
    setDocuments([]);
    setSelectedDocId('');
  };

  // Execute batch processing across all documents
  const handleExecuteBatchMinimization = async () => {
    if (documents.length === 0 || !queryPrompt.trim()) return;

    setIsProcessingBatch(true);
    setCurrentProcessingIndex(0);

    const updatedDocuments = [...documents];

    for (let i = 0; i < updatedDocuments.length; i++) {
      setCurrentProcessingIndex(i + 1);
      const doc = updatedDocuments[i];

      // Mark processing
      updatedDocuments[i] = { ...doc, status: 'PROCESSING' };
      setDocuments([...updatedDocuments]);

      try {
        const result = await processDocumentMinimization(
          doc.content,
          queryPrompt,
          activeFilters,
          maskingStrategy
        );

        updatedDocuments[i] = {
          ...doc,
          status: 'COMPLETED',
          result,
        };

        // Merge tokens into the global vault
        onUpdateGlobalVault(result.vaultMapping);
      } catch (err: any) {
        console.error(`Error processing ${doc.name}:`, err);
        updatedDocuments[i] = {
          ...doc,
          status: 'ERROR',
          errorMessage: err.message || 'Minimization extraction failed',
        };
      }

      setDocuments([...updatedDocuments]);
    }

    setIsProcessingBatch(false);
  };

  // Download all sanitized documents as a ZIP archive
  const handleDownloadAllZip = async () => {
    const completedDocs = documents.filter((d) => d.status === 'COMPLETED' && d.result);
    if (completedDocs.length === 0) {
      alert('Please process documents before exporting zip archive.');
      return;
    }

    setIsZipping(true);
    try {
      const zip = new JSZip();
      const auditSummaryList: any[] = [];

      completedDocs.forEach((doc, idx) => {
        const result = doc.result!;
        const cleanExt = doc.name.endsWith('.md') || doc.name.endsWith('.txt') ? '' : '.md';
        const zipFileName = `sanitized_${doc.name.replace(/\.[^/.]+$/, '')}${cleanExt || '.md'}`;

        zip.file(zipFileName, result.sanitizedExtractedText);

        auditSummaryList.push({
          file: doc.name,
          redactedFileName: zipFileName,
          originalLength: result.originalLength,
          sanitizedLength: result.extractedLength,
          reductionPercentage: `${result.reductionPercentage}%`,
          entitiesRedactedCount: result.entities.length,
          categoriesMasked: Array.from(new Set(result.entities.map((e) => e.category))),
          minimizationRationale: result.excludedSectionsRationale,
        });
      });

      // Include JSON Audit Report
      zip.file(
        'AUDIT_REPORT.json',
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            queryObjective: queryPrompt,
            maskingStrategy,
            totalDocumentsProcessed: completedDocs.length,
            auditSummary: auditSummaryList,
          },
          null,
          2
        )
      );

      // Include Human-Readable Audit Readme
      const readmeContent = [
        `========================================================================`,
        `AEGISPRIVACY BATCH REDACTION & DATA MINIMIZATION ARCHIVE`,
        `Generated: ${new Date().toUTCString()}`,
        `Query Objective: "${queryPrompt}"`,
        `Masking Strategy: ${maskingStrategy}`,
        `========================================================================`,
        ``,
        `SUMMARY OF PROCESSED FILES (${completedDocs.length} Total):`,
        ...auditSummaryList.map(
          (s, i) =>
            `${i + 1}. ${s.file} -> ${s.redactedFileName}\n   Reduction: ${s.reductionPercentage} | Entities Redacted: ${s.entitiesRedactedCount} (${s.categoriesMasked.join(', ') || 'None'})`
        ),
        ``,
        `All sensitive PII (names, emails, phones, financial, credentials) have been`,
        `anonymized. Safe for direct ingestion into Generative AI platforms.`,
      ].join('\n');

      zip.file('README_REDACTION_AUDIT.txt', readmeContent);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AegisPrivacy-Redacted-Documents-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate zip:', err);
      alert('Error creating zip archive');
    } finally {
      setIsZipping(false);
    }
  };

  // Selected document helper
  const selectedDoc = documents.find((d) => d.id === selectedDocId) || documents[0];
  const selectedResult = selectedDoc?.result;

  const handleCopySingleDoc = () => {
    if (!selectedResult) return;
    const textToCopy =
      activeViewMode === 'minimized_raw'
        ? selectedResult.minimizedExtractedText
        : selectedResult.sanitizedExtractedText;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingleDoc = () => {
    if (!selectedDoc || !selectedResult) return;
    const textToDownload =
      activeViewMode === 'minimized_raw'
        ? selectedResult.minimizedExtractedText
        : selectedResult.sanitizedExtractedText;

    const blob = new Blob([textToDownload], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sanitized_${selectedDoc.name.replace(/\.[^/.]+$/, '')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Aggregate stats across the batch
  const completedDocsCount = documents.filter((d) => d.status === 'COMPLETED').length;
  const totalEntitiesRedactedInBatch = documents.reduce(
    (acc, d) => acc + (d.result?.entities.length || 0),
    0
  );
  const totalOriginalChars = documents.reduce((acc, d) => acc + d.size, 0);
  const totalSanitizedChars = documents.reduce(
    (acc, d) => acc + (d.result?.extractedLength || d.size),
    0
  );
  const aggregateReduction =
    totalOriginalChars > 0
      ? Math.max(
          0,
          Math.round(((totalOriginalChars - totalSanitizedChars) / totalOriginalChars) * 100)
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Overview Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Multi-Document Data Minimizer & Batch Redaction</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Drag and drop multiple files to isolate query-relevant facts, sanitize PII, and download the full batch as a ZIP archive.
          </p>
        </div>

        {/* Global Batch Action Buttons */}
        <div className="flex items-center gap-2.5">
          {completedDocsCount > 0 && (
            <button
              onClick={handleDownloadAllZip}
              disabled={isZipping}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
            >
              <FolderArchive className="w-4 h-4" />
              <span>
                {isZipping
                  ? 'Compiling ZIP Archive...'
                  : `Download Redacted ZIP (${completedDocsCount})`}
              </span>
            </button>
          )}

          <button
            onClick={handleLoadSampleSuite}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:text-white rounded-lg transition-colors whitespace-nowrap"
            title="Load sample documents into the queue"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Load Sample Suite (3 Docs)</span>
          </button>
        </div>
      </div>

      {/* Drag-and-Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-3 ${
          isDragOver
            ? 'bg-indigo-950/30 border-indigo-500 text-indigo-200 scale-[1.005]'
            : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 text-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.json,.csv,.log,.xml,.tsv"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <FileUp className="w-6 h-6 stroke-[1.8]" />
        </div>

        <div>
          <p className="text-sm font-semibold text-white">
            Drag & drop multiple files here, or <span className="text-indigo-400 underline decoration-indigo-400/40">browse from computer</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Supports batch processing for <code className="text-slate-400">.txt</code>, <code className="text-slate-400">.md</code>, <code className="text-slate-400">.json</code>, <code className="text-slate-400">.csv</code>, <code className="text-slate-400">.log</code>
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
          <span>Client-Side File Parsing</span>
          <span aria-hidden="true">·</span>
          <span>Automatic PII Redaction</span>
          <span aria-hidden="true">·</span>
          <span>1-Click ZIP Archive Output</span>
        </div>
      </div>

      {/* Target Query Bar & Execution Controls */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Target AI Query & Objective (Applied Across Batch)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Specify what data the AI should focus on. Non-pertinent sections will be pruned away across all documents.
            </p>
          </div>

          {/* Quick preset queries */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-slate-500">Quick Query:</span>
            {SAMPLE_DOCUMENTS.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setQueryPrompt(doc.suggestedQuery)}
                className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors truncate max-w-xs"
                title={doc.suggestedQuery}
              >
                {doc.title.split(' ')[0]}...
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={queryPrompt}
            onChange={(e) => setQueryPrompt(e.target.value)}
            placeholder="e.g. Extract only technical root cause and remediation actions without personal identifiers or credentials..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />

          <button
            onClick={handleExecuteBatchMinimization}
            disabled={isProcessingBatch || documents.length === 0 || !queryPrompt.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
          >
            {isProcessingBatch ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>
                  Processing {currentProcessingIndex} of {documents.length}...
                </span>
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                <span>Process All Documents ({documents.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Batch Overview & Queue List */}
      {documents.length > 0 && (
        <div className="space-y-3">
          {/* Batch Metrics Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">Total Documents</span>
              <p className="text-base font-bold text-white font-mono tabular-nums">
                {documents.length} <span className="text-xs font-normal text-slate-400">files</span>
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">Processed State</span>
              <p className="text-base font-bold text-indigo-400 font-mono tabular-nums">
                {completedDocsCount} / {documents.length} <span className="text-xs font-normal text-slate-400">ready</span>
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">PII Redacted</span>
              <p className="text-base font-bold text-amber-400 font-mono tabular-nums">
                {totalEntitiesRedactedInBatch} <span className="text-xs font-normal text-slate-400">entities masked</span>
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">Payload Reduction</span>
              <p className="text-base font-bold text-emerald-400 font-mono tabular-nums">
                {completedDocsCount > 0 ? `-${aggregateReduction}%` : '—'} <span className="text-xs font-normal text-slate-400">pruned</span>
              </p>
            </div>
          </div>

          {/* Queue Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60 shadow-sm">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-400">
              <div className="flex items-center gap-2">
                <span>Queued Documents ({documents.length})</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-500 font-normal">Click any row to inspect sanitized artifact</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleClearAllDocs}
                  className="text-slate-500 hover:text-rose-400 transition-colors"
                >
                  Clear Queue
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-800/80 text-xs">
              {documents.map((doc, idx) => {
                const isSelected = selectedDocId === doc.id;
                const result = doc.result;

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`grid grid-cols-12 px-5 py-3.5 items-center gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-950/30 text-white'
                        : 'hover:bg-slate-900/40 text-slate-300'
                    }`}
                  >
                    {/* Index & File Icon */}
                    <div className="col-span-4 sm:col-span-4 flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-slate-500 text-[11px] w-5">
                        {(idx + 1).toString().padStart(2, '0')}.
                      </span>
                      <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span className="font-medium truncate text-white" title={doc.name}>
                        {doc.name}
                      </span>
                    </div>

                    {/* File Size */}
                    <div className="col-span-2 hidden sm:block text-slate-400 font-mono text-[11px]">
                      {(doc.size / 1024).toFixed(1)} KB
                    </div>

                    {/* Status Badge */}
                    <div className="col-span-4 sm:col-span-4">
                      {doc.status === 'PENDING' && (
                        <span className="text-slate-500 text-[11px]">
                          Pending batch processing
                        </span>
                      )}
                      {doc.status === 'PROCESSING' && (
                        <span className="text-indigo-400 text-[11px] flex items-center gap-1.5 font-medium">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Extracting & Redacting...</span>
                        </span>
                      )}
                      {doc.status === 'COMPLETED' && result && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Sanitized</span>
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-amber-400 font-mono">
                            {result.entities.length} PII
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-emerald-400 font-mono">
                            -{result.reductionPercentage}%
                          </span>
                        </div>
                      )}
                      {doc.status === 'ERROR' && (
                        <span className="text-rose-400 text-[11px] flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>{doc.errorMessage || 'Failed'}</span>
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-4 sm:col-span-2 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {doc.status === 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setSelectedDocId(doc.id);
                            handleDownloadSingleDoc();
                          }}
                          className="p-1 text-slate-400 hover:text-white transition-colors"
                          title="Download this sanitized file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleRemoveDoc(doc.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Remove file from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Selected Document Artifact Inspector */}
      {selectedDoc && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-slate-900/90 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Artifact Inspector:</span>
                  <span className="text-indigo-400 font-mono">{selectedDoc.name}</span>
                </h3>
                {selectedResult && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {selectedResult.relevantSummary}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedResult && (
                <>
                  <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                    <button
                      onClick={() => setActiveViewMode('sanitized')}
                      className={`px-2.5 py-1 font-medium rounded transition-colors ${
                        activeViewMode === 'sanitized'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sanitized (Clean)
                    </button>
                    <button
                      onClick={() => setActiveViewMode('minimized_raw')}
                      className={`px-2.5 py-1 font-medium rounded transition-colors ${
                        activeViewMode === 'minimized_raw'
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Raw Extracted
                    </button>
                  </div>

                  <button
                    onClick={handleCopySingleDoc}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors border border-slate-700/60"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownloadSingleDoc}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .md</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-5 bg-slate-950/80">
            {selectedResult ? (
              <div className="space-y-4">
                {/* Rationale callout */}
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-300">Minimization Rationale:</span> {selectedResult.excludedSectionsRationale}
                </div>

                <pre className="font-mono text-xs leading-relaxed text-slate-200 whitespace-pre-wrap max-h-[380px] overflow-y-auto selection:bg-indigo-500/30">
                  {activeViewMode === 'minimized_raw'
                    ? selectedResult.minimizedExtractedText
                    : selectedResult.sanitizedExtractedText}
                </pre>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-900">
                  <span>Raw Source File Content (Awaiting batch execution)</span>
                  <span className="font-mono tabular-nums">{selectedDoc.content.length} chars</span>
                </div>
                <pre className="font-mono text-xs leading-relaxed text-slate-400 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                  {selectedDoc.content}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
