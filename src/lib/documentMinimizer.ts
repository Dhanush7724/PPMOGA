import {
  DocumentMinimizationResult,
  MaskingStrategy,
  PIIFilterRule,
} from '../types/privacy';
import { redactText } from './piiEngine';

export async function processDocumentMinimization(
  documentText: string,
  query: string,
  activeFilters: PIIFilterRule[],
  maskingStrategy: MaskingStrategy
): Promise<DocumentMinimizationResult> {
  const originalLength = documentText.length;

  // Try calling server-side Gemini first for high-fidelity semantic extraction
  try {
    const response = await fetch('/api/gemini/analyze-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentText,
        query,
        activeFilters: activeFilters.filter((f) => f.enabled).map((f) => f.name),
        maskingStrategy,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.minimizedExtractedText) {
        // Redact any remaining entities with client engine to ensure 100% token vault coverage
        const localRedaction = redactText(
          data.minimizedExtractedText,
          activeFilters,
          maskingStrategy
        );

        const extractedLength = localRedaction.sanitizedText.length;
        const reductionPercentage = Math.max(
          0,
          Math.round(((originalLength - extractedLength) / originalLength) * 100)
        );

        return {
          originalText: documentText,
          originalLength,
          query,
          extractedLength,
          reductionPercentage,
          relevantSummary:
            data.relevantSummary ||
            `Extracted core sections matching query: "${query}"`,
          minimizedExtractedText: data.minimizedExtractedText,
          sanitizedExtractedText: localRedaction.sanitizedText,
          excludedSectionsRationale:
            data.excludedSectionsRationale ||
            'Pruned non-essential background context, personal metadata, and unreferenced subsections.',
          entities: localRedaction.entities,
          vaultMapping: localRedaction.vaultMapping,
          isAiEnhanced: true,
        };
      }
    }
  } catch (err) {
    console.warn('Server AI analysis skipped, utilizing local minimization engine:', err);
  }

  // Local Data Minimization & Relevance Extraction Engine
  const queryWords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Split document into structured sections or paragraphs
  const rawSections = documentText
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  interface ScoredSection {
    text: string;
    score: number;
    matchedKeywords: string[];
    isHeader: boolean;
  }

  const scoredSections: ScoredSection[] = rawSections.map((sec) => {
    const lowerSec = sec.toLowerCase();
    const matched: string[] = [];
    let score = 0;

    // Header detection
    const isHeader = /^#{1,4}\s+|^(?:Section|Chapter|Part|Topic)\s+\d+/i.test(sec) || sec.length < 60 && sec.endsWith(':');

    // Query word matches
    for (const word of queryWords) {
      const occurrences = (lowerSec.match(new RegExp(`\\b${word}`, 'g')) || []).length;
      if (occurrences > 0) {
        score += occurrences * 3;
        matched.push(word);
      }
    }

    // Numbers, metrics, errors or status terms often contain critical signal
    if (/\d+[\d,.]*|\b(?:error|issue|incident|cost|budget|recommend|status|approved|latency)\b/i.test(sec)) {
      score += 1.5;
    }

    // Penalize generic disclaimers or signatures
    if (/\b(?:confidentiality notice|all rights reserved|disclaimer|terms and conditions|sent from my iphone|this email and any attachments)\b/i.test(sec)) {
      score -= 8;
    }

    return { text: sec, score, matchedKeywords: matched, isHeader };
  });

  // If query is broad or no word matched, select sections with actionable content
  const averageScore =
    scoredSections.reduce((acc, s) => acc + s.score, 0) / (scoredSections.length || 1);
  const threshold = Math.max(1, averageScore * 0.7);

  const selectedSections = scoredSections.filter(
    (s) => s.score >= threshold || (s.isHeader && s.score > 0)
  );

  const keptTexts = selectedSections.length > 0
    ? selectedSections.map((s) => s.text)
    : scoredSections.slice(0, Math.min(3, scoredSections.length)).map((s) => s.text);

  const assembledCleanDocument = [
    `# QUERY-TARGETED EXTRACTED CONTEXT`,
    `Target Objective: ${query || 'General Information Retrieval'}`,
    `Data Minimization: Filtered ${rawSections.length - keptTexts.length} irrelevant sections out of ${rawSections.length} total blocks.`,
    `---`,
    ...keptTexts,
  ].join('\n\n');

  // Redact PII in the assembled document
  const redaction = redactText(assembledCleanDocument, activeFilters, maskingStrategy);

  const reductionPercentage = Math.max(
    0,
    Math.round(((originalLength - redaction.sanitizedText.length) / originalLength) * 100)
  );

  return {
    originalText: documentText,
    originalLength,
    query,
    extractedLength: redaction.sanitizedText.length,
    reductionPercentage,
    relevantSummary: `Isolated ${keptTexts.length} highly relevant document blocks directly addressing: "${query}".`,
    minimizedExtractedText: assembledCleanDocument,
    sanitizedExtractedText: redaction.sanitizedText,
    excludedSectionsRationale: `Filtered out ${rawSections.length - keptTexts.length} tangential paragraphs, legal boilerplates, and out-of-scope personal history to satisfy strict Data Minimization rules.`,
    entities: redaction.entities,
    vaultMapping: redaction.vaultMapping,
    isAiEnhanced: false,
  };
}
