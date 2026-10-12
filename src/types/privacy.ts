export type MaskingStrategy = 'TAG_TOKENS' | 'PSEUDONYMS' | 'BLACKOUT_BLOCK' | 'HASH_SALT';

export type PIICategory =
  | 'NAME'
  | 'EMAIL'
  | 'PHONE'
  | 'ADDRESS'
  | 'SSN_TAX'
  | 'FINANCIAL'
  | 'SECRET'
  | 'IP_ADDRESS'
  | 'MEDICAL'
  | 'CUSTOM';

export interface PIIFilterRule {
  id: string;
  name: string;
  category: PIICategory;
  description: string;
  enabled: boolean;
  sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';
  customPattern?: string;
  examples: string[];
}

export interface DetectedEntity {
  id: string;
  originalText: string;
  replacementText: string;
  category: PIICategory;
  startIndex: number;
  endIndex: number;
  confidence: number;
  contextSnippet: string;
  rationale: string;
}

export interface RedactionResult {
  originalText: string;
  sanitizedText: string;
  entities: DetectedEntity[];
  vaultMapping: Record<string, string>; // replacement -> original
  reverseMapping: Record<string, string>; // original -> replacement
  stats: {
    totalEntities: number;
    categoryCounts: Record<PIICategory, number>;
    charReduction: number;
    entropyProtectionScore: number;
  };
}

export interface DocumentMinimizationResult {
  originalText: string;
  originalLength: number;
  query: string;
  extractedLength: number;
  reductionPercentage: number;
  relevantSummary: string;
  minimizedExtractedText: string;
  sanitizedExtractedText: string;
  excludedSectionsRationale: string;
  entities: DetectedEntity[];
  vaultMapping: Record<string, string>;
  isAiEnhanced: boolean;
}

export interface ModelProvider {
  id: string;
  name: string;
  modelCode: string;
  vendor: string;
  contextWindow: string;
  privacyGuarantee: string;
  supportsRealExecution: boolean;
}
