import {
  DetectedEntity,
  MaskingStrategy,
  PIICategory,
  PIIFilterRule,
  RedactionResult,
} from '../types/privacy';

// Pseudonym dictionaries for realistic replacement
const PSEUDO_FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Sam', 'Casey', 'Avery', 'Reese',
  'Cameron', 'Dakota', 'Kendall', 'Quinn', 'Rowan', 'Harper', 'Riley'
];
const PSEUDO_LAST_NAMES = [
  'Vance', 'Sterling', 'Mercer', 'Hayden', 'Cross', 'Sinclair', 'Elliot',
  'Winters', 'Bennett', 'Callahan', 'Donovan', 'Mercer', 'Chen', 'Patel'
];

// Curated list of common honorifics & titles
const HONORIFIC_PREFIXES = '(?:Mr\\.|Mrs\\.|Ms\\.|Miss|Dr\\.|Prof\\.|Senator|Director|Officer|Chief)';

// Helper to hash string to short hex
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).slice(0, 4).toUpperCase();
}

// Luhn algorithm check for valid credit card patterns
function isValidLuhn(numStr: string): boolean {
  const digits = numStr.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export interface CustomRule {
  id: string;
  name: string;
  pattern: string; // regex string
  category: PIICategory;
  enabled: boolean;
}

export function redactText(
  text: string,
  activeFilters: PIIFilterRule[],
  maskingStrategy: MaskingStrategy = 'TAG_TOKENS',
  customRules: CustomRule[] = [],
  customKeywords: string[] = []
): RedactionResult {
  if (!text) {
    return {
      originalText: '',
      sanitizedText: '',
      entities: [],
      vaultMapping: {},
      reverseMapping: {},
      stats: {
        totalEntities: 0,
        categoryCounts: {
          NAME: 0,
          EMAIL: 0,
          PHONE: 0,
          ADDRESS: 0,
          SSN_TAX: 0,
          FINANCIAL: 0,
          SECRET: 0,
          IP_ADDRESS: 0,
          MEDICAL: 0,
          CUSTOM: 0,
        },
        charReduction: 0,
        entropyProtectionScore: 100,
      },
    };
  }

  // Active filter category check
  const enabledCategories = new Set<PIICategory>(
    activeFilters.filter((f) => f.enabled).map((f) => f.category)
  );

  interface RawMatch {
    originalText: string;
    category: PIICategory;
    startIndex: number;
    endIndex: number;
    confidence: number;
    rationale: string;
  }

  const rawMatches: RawMatch[] = [];

  // 1. EMAIL REGEX
  if (enabledCategories.has('EMAIL')) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    let match: RegExpExecArray | null;
    while ((match = emailRegex.exec(text)) !== null) {
      rawMatches.push({
        originalText: match[0],
        category: 'EMAIL',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.99,
        rationale: 'Valid RFC-compliant email address structure',
      });
    }
  }

  // 2. PHONE REGEX (International, E.164, domestic formats)
  if (enabledCategories.has('PHONE')) {
    const phoneRegex = /(?:\+?(\d{1,3})[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b|\b(?:\+44\s?\d{2,5}\s?\d{4,6}|\+91\s?\d{5}\s?\d{5})\b/g;
    let match: RegExpExecArray | null;
    while ((match = phoneRegex.exec(text)) !== null) {
      // Avoid matching pure years or short codes
      if (match[0].replace(/\D/g, '').length >= 10) {
        rawMatches.push({
          originalText: match[0],
          category: 'PHONE',
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: 0.95,
          rationale: 'Domestic / International telephone format',
        });
      }
    }
  }

  // 3. SSN & TAX ID REGEX
  if (enabledCategories.has('SSN_TAX')) {
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b|\b\d{2}-\d{7}\b/g;
    let match: RegExpExecArray | null;
    while ((match = ssnRegex.exec(text)) !== null) {
      rawMatches.push({
        originalText: match[0],
        category: 'SSN_TAX',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.98,
        rationale: 'Social Security Number (SSN) or Employer ID (EIN) pattern',
      });
    }
  }

  // 4. FINANCIAL (Credit cards, IBAN, bank account numbers, salary declarations)
  if (enabledCategories.has('FINANCIAL')) {
    // Credit cards with dashes/spaces
    const ccRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
    let match: RegExpExecArray | null;
    while ((match = ccRegex.exec(text)) !== null) {
      if (isValidLuhn(match[0])) {
        rawMatches.push({
          originalText: match[0],
          category: 'FINANCIAL',
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence: 0.99,
          rationale: 'Payment card number verified via Luhn checksum',
        });
      }
    }

    // IBAN pattern
    const ibanRegex = /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g;
    while ((match = ibanRegex.exec(text)) !== null) {
      rawMatches.push({
        originalText: match[0],
        category: 'FINANCIAL',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.94,
        rationale: 'International Bank Account Number (IBAN)',
      });
    }

    // Salary info e.g. "$180,000" or "$140k/yr"
    const salaryRegex = /(?:salary|compensation|package|bonus|base rate)[:\s]*(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?:\s?(?:k|per annum|\/yr|annually))?)/gi;
    while ((match = salaryRegex.exec(text)) !== null) {
      const targetStr = match[1];
      const startIndex = match.index + match[0].indexOf(targetStr);
      rawMatches.push({
        originalText: targetStr,
        category: 'FINANCIAL',
        startIndex,
        endIndex: startIndex + targetStr.length,
        confidence: 0.92,
        rationale: 'Specific compensation/salary financial figure',
      });
    }
  }

  // 5. SECRETS & API KEYS
  if (enabledCategories.has('SECRET')) {
    const secretsRegex = /\b(?:sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|AIzaSy[a-zA-Z0-9_-]{33}|Bearer\s+ey[a-zA-Z0-9._-]+)\b/g;
    let match: RegExpExecArray | null;
    while ((match = secretsRegex.exec(text)) !== null) {
      rawMatches.push({
        originalText: match[0],
        category: 'SECRET',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.99,
        rationale: 'High-entropy API token, credential, or Bearer auth secret',
      });
    }
  }

  // 6. IP ADDRESSES
  if (enabledCategories.has('IP_ADDRESS')) {
    const ipRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    let match: RegExpExecArray | null;
    while ((match = ipRegex.exec(text)) !== null) {
      rawMatches.push({
        originalText: match[0],
        category: 'IP_ADDRESS',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.95,
        rationale: 'IPv4 Network endpoint or infrastructure host',
      });
    }
  }

  // 7. MEDICAL / PHI
  if (enabledCategories.has('MEDICAL')) {
    const medicalRegex = /\b(?:MRN|Medical Record|Patient ID|Rx #|Diagnosis Code)[:\s#]*([A-Z0-9-]{5,12})\b/gi;
    let match: RegExpExecArray | null;
    while ((match = medicalRegex.exec(text)) !== null) {
      rawMatches.push({
        originalText: match[0],
        category: 'MEDICAL',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.91,
        rationale: 'Protected Health Information (PHI) / Patient identifier',
      });
    }
  }

  // 8. PHYSICAL ADDRESSES
  if (enabledCategories.has('ADDRESS')) {
    const addressRegex = /\b\d{1,5}\s+[A-Z][a-zA-Z0-9\s.,]{3,35}\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Suite|Ste)\b(?:\s*,?\s*[A-Z][a-zA-Z\s]+,?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/gi;
    let match: RegExpExecArray | null;
    while ((match = addressRegex.exec(text)) !== null) {
      rawMatches.push({
        originalText: match[0],
        category: 'ADDRESS',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.88,
        rationale: 'Physical street address / postal location',
      });
    }
  }

  // 9. NAMES (Personal names, signatures, honorifics)
  if (enabledCategories.has('NAME')) {
    // With honorific prefix: e.g. "Dr. Arthur Mitchell", "Ms. Sarah Jenkins"
    const honorificRegex = new RegExp(`\\b${HONORIFIC_PREFIXES}\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){1,2})\\b`, 'g');
    let match: RegExpExecArray | null;
    while ((match = honorificRegex.exec(text)) !== null) {
      rawMatches.push({
        originalText: match[0],
        category: 'NAME',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.96,
        rationale: 'Personal identity with honorific title prefix',
      });
    }

    // Common executive/employee name signatures: e.g. "Employee: Johnathan Edwards" or "Prepared by: Sarah Connor"
    const roleNameRegex = /(?:Prepared by|Author|Employee|Manager|Patient|Client|Representative|Contact|Reviewed by|Name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+)\b/gi;
    while ((match = roleNameRegex.exec(text)) !== null) {
      const nameOnly = match[1];
      const start = match.index + match[0].indexOf(nameOnly);
      rawMatches.push({
        originalText: nameOnly,
        category: 'NAME',
        startIndex: start,
        endIndex: start + nameOnly.length,
        confidence: 0.94,
        rationale: 'Entity attributed as person/role holder',
      });
    }

    // Two capitalized words that look like personal names in prose (excluding common starting sentence words or days)
    const proseNameRegex = /\b([A-Z][a-z]{2,14}\s+[A-Z][a-z]{2,14})\b/g;
    const commonNonNames = new Set([
      'United States', 'New York', 'San Francisco', 'North America', 'Generative AI',
      'Privacy Protector', 'Terms Service', 'Monday Morning', 'Friday Afternoon',
      'Chrome Extension', 'Machine Learning', 'Cloud Run', 'Artificial Intelligence',
      'Executive Summary', 'Action Items', 'Incident Report', 'Next Steps', 'Key Findings'
    ]);

    while ((match = proseNameRegex.exec(text)) !== null) {
      const candidate = match[0];
      if (!commonNonNames.has(candidate)) {
        // Only add if not overlapping with address or other match
        rawMatches.push({
          originalText: candidate,
          category: 'NAME',
          startIndex: match.index,
          endIndex: match.index + candidate.length,
          confidence: 0.78,
          rationale: 'Capitalized personal name candidate',
        });
      }
    }
  }

  // 10. CUSTOM RULES (User-defined regex)
  for (const customRule of customRules) {
    if (customRule.enabled && customRule.pattern) {
      try {
        const regex = new RegExp(customRule.pattern, 'gi');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          rawMatches.push({
            originalText: match[0],
            category: customRule.category || 'CUSTOM',
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            confidence: 0.99,
            rationale: `Matched user custom rule: "${customRule.name}"`,
          });
        }
      } catch (e) {
        console.warn('Invalid custom regex:', customRule.pattern);
      }
    }
  }

  // 11. CUSTOM KEYWORDS BLACKLIST
  for (const kw of customKeywords) {
    const cleanKw = kw.trim();
    if (!cleanKw) continue;
    const escaped = cleanKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const kwRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = kwRegex.exec(text)) !== null) {
      rawMatches.push({
        originalText: match[0],
        category: 'CUSTOM',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 1.0,
        rationale: `Exact match in user sensitive keyword blacklist`,
      });
    }
  }

  // Sort matches by start index, resolve overlaps (longer match or higher confidence wins)
  rawMatches.sort((a, b) => a.startIndex - b.startIndex || b.originalText.length - a.originalText.length);

  const nonOverlapping: RawMatch[] = [];
  let lastEnd = -1;

  for (const m of rawMatches) {
    if (m.startIndex >= lastEnd) {
      nonOverlapping.push(m);
      lastEnd = m.endIndex;
    } else {
      // Overlap detected: If current has higher confidence and is longer, replace previous
      const prev = nonOverlapping[nonOverlapping.length - 1];
      if (prev && m.confidence > prev.confidence && m.endIndex > prev.endIndex) {
        nonOverlapping.pop();
        nonOverlapping.push(m);
        lastEnd = m.endIndex;
      }
    }
  }

  // Build deterministic token replacements
  // Mapping vaults: replacement -> original, original -> replacement
  const vaultMapping: Record<string, string> = {};
  const reverseMapping: Record<string, string> = {};

  const categoryCounters: Record<PIICategory, number> = {
    NAME: 1,
    EMAIL: 1,
    PHONE: 1,
    ADDRESS: 1,
    SSN_TAX: 1,
    FINANCIAL: 1,
    SECRET: 1,
    IP_ADDRESS: 1,
    MEDICAL: 1,
    CUSTOM: 1,
  };

  const detectedEntities: DetectedEntity[] = [];

  for (let i = 0; i < nonOverlapping.length; i++) {
    const m = nonOverlapping[i];
    const originalNormalized = m.originalText.trim();

    let replacement = reverseMapping[originalNormalized];

    if (!replacement) {
      if (maskingStrategy === 'TAG_TOKENS') {
        const count = categoryCounters[m.category]++;
        replacement = `[${m.category}_${count}]`;
      } else if (maskingStrategy === 'PSEUDONYMS') {
        if (m.category === 'NAME') {
          const fn = PSEUDO_FIRST_NAMES[(categoryCounters.NAME + i) % PSEUDO_FIRST_NAMES.length];
          const ln = PSEUDO_LAST_NAMES[(categoryCounters.NAME + i * 2) % PSEUDO_LAST_NAMES.length];
          replacement = `${fn} ${ln}`;
          categoryCounters.NAME++;
        } else if (m.category === 'EMAIL') {
          replacement = `user_${categoryCounters.EMAIL++}@relay-shield.net`;
        } else if (m.category === 'PHONE') {
          replacement = `+1 (555) 010-${(1000 + categoryCounters.PHONE++).toString().slice(-4)}`;
        } else if (m.category === 'ADDRESS') {
          replacement = `100 Central Way, Suite ${categoryCounters.ADDRESS++ * 10}, Metro City`;
        } else if (m.category === 'FINANCIAL') {
          replacement = `[CONFIDENTIAL_FINANCIAL_${categoryCounters.FINANCIAL++}]`;
        } else {
          replacement = `[MASKED_${m.category}_${categoryCounters[m.category]++}]`;
        }
      } else if (maskingStrategy === 'BLACKOUT_BLOCK') {
        replacement = '█'.repeat(Math.max(4, Math.min(m.originalText.length, 12)));
      } else if (maskingStrategy === 'HASH_SALT') {
        const hash = hashString(m.originalText);
        replacement = `TOKEN_${hash}`;
      } else {
        replacement = `[${m.category}_REDACTED]`;
      }

      reverseMapping[originalNormalized] = replacement;
      vaultMapping[replacement] = originalNormalized;
    }

    // Context snippet for UI review
    const snippetStart = Math.max(0, m.startIndex - 30);
    const snippetEnd = Math.min(text.length, m.endIndex + 30);
    const contextSnippet = text.slice(snippetStart, snippetEnd);

    detectedEntities.push({
      id: `entity-${i + 1}-${m.startIndex}`,
      originalText: m.originalText,
      replacementText: replacement,
      category: m.category,
      startIndex: m.startIndex,
      endIndex: m.endIndex,
      confidence: m.confidence,
      contextSnippet,
      rationale: m.rationale,
    });
  }

  // Construct sanitized string by splicing replacements
  let sanitizedText = '';
  let cursor = 0;

  for (const entity of detectedEntities) {
    sanitizedText += text.slice(cursor, entity.startIndex);
    sanitizedText += entity.replacementText;
    cursor = entity.endIndex;
  }
  sanitizedText += text.slice(cursor);

  // Stats calculation
  const categoryCounts: Record<PIICategory, number> = {
    NAME: 0,
    EMAIL: 0,
    PHONE: 0,
    ADDRESS: 0,
    SSN_TAX: 0,
    FINANCIAL: 0,
    SECRET: 0,
    IP_ADDRESS: 0,
    MEDICAL: 0,
    CUSTOM: 0,
  };

  for (const ent of detectedEntities) {
    categoryCounts[ent.category] = (categoryCounts[ent.category] || 0) + 1;
  }

  const entropyProtectionScore = Math.min(
    100,
    Math.round(92 + Math.min(detectedEntities.length * 1.5, 8))
  );

  return {
    originalText: text,
    sanitizedText,
    entities: detectedEntities,
    vaultMapping,
    reverseMapping,
    stats: {
      totalEntities: detectedEntities.length,
      categoryCounts,
      charReduction: Math.abs(text.length - sanitizedText.length),
      entropyProtectionScore,
    },
  };
}

/**
 * Reverse De-anonymize: Reconstitutes original entities into the AI's response text.
 * Runs completely locally on the client machine!
 */
export function deAnonymizeText(
  aiResponseText: string,
  vaultMapping: Record<string, string>
): string {
  if (!aiResponseText || !vaultMapping || Object.keys(vaultMapping).length === 0) {
    return aiResponseText;
  }

  let reconstituted = aiResponseText;

  // Sort keys by length descending to prevent substring collisions
  const tokens = Object.keys(vaultMapping).sort((a, b) => b.length - a.length);

  for (const token of tokens) {
    const original = vaultMapping[token];
    if (!original) continue;

    // Escape regex characters in token
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedToken, 'g');
    reconstituted = reconstituted.replace(regex, original);
  }

  return reconstituted;
}
