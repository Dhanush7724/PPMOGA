import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json({ limit: '20mb' }));

// Initialize Gemini SDK with User-Agent as required by skill guidelines
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    engine: 'AegisPrivacy Shield Core v2.4',
  });
});

// Endpoint: Intelligent Query-Relevant Document Extraction & PII Redaction
app.post('/api/gemini/analyze-document', async (req, res) => {
  try {
    const { documentText, query, activeFilters, maskingStrategy } = req.body;

    if (!documentText || typeof documentText !== 'string') {
      return res.status(400).json({ error: 'Document text is required' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API is not configured on server',
        fallback: true,
      });
    }

    const filtersDescription = Array.isArray(activeFilters)
      ? activeFilters.join(', ')
      : 'Names, Emails, Phone Numbers, Addresses, Financial info, API Keys';

    const systemPrompt = `You are a privacy-preserving Data Minimization and PII Redaction Engine.
The user is preparing a document to send to a Generative AI platform for a specific query: "${query || 'General analysis'}".
Your tasks:
1. DATA MINIMIZATION: Extract ONLY the facts, sections, context, and data from the document that are strictly necessary and relevant to answer this specific query. Exclude all irrelevant private details, tangential paragraphs, and superfluous personal background.
2. PII IDENTIFICATION: Detect all sensitive entities (including ${filtersDescription}) that exist in the relevant text.
3. SANITIZATION: In the extracted text, mask or anonymize all sensitive entities according to the strategy: "${maskingStrategy || 'TAG_TOKENS'}" (e.g., if TAG_TOKENS, replace with [PERSON_1], [EMAIL_1], [PHONE_1], [ORG_1], [ADDRESS_1], [FINANCIAL_1], [SECRET_1]; if PSEUDONYMS, use realistic fictitious replacements).
4. Return a structured JSON response matching the following schema.`;

    const prompt = `DOCUMENT CONTENT:
---
${documentText.slice(0, 30000)}
---

USER QUERY / PURPOSE:
"${query || 'Extract essential operational facts and redact all private entities.'}"

Return valid JSON with these exact fields:
{
  "relevantSummary": "Brief overview of what data was deemed relevant to the query",
  "minimizedExtractedText": "The extracted relevant document content with sensitive PII replaced by anonymized tokens according to strategy",
  "detectedEntities": [
    {
      "original": "exact original string",
      "replacement": "replacement token or pseudonym",
      "category": "NAME | EMAIL | PHONE | ADDRESS | FINANCIAL | SECRET | ORG | OTHER",
      "reason": "Why this was flagged and redacted",
      "relevanceScore": "HIGH | MEDIUM | LOW"
    }
  ],
  "excludedSectionsRationale": "Explanation of what non-relevant private portions were pruned away for data minimization"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const outputText = response.text || '{}';
    const parsed = JSON.parse(outputText);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error analyzing document with Gemini:', err);
    return res.status(500).json({
      error: err.message || 'Failed to process document with Gemini',
      fallback: true,
    });
  }
});

// Endpoint: Send sanitized prompt to Gemini as a secure third-party integration proxy
app.post('/api/gemini/execute-sanitized', async (req, res) => {
  try {
    const { sanitizedPrompt, systemInstruction } = req.body;

    if (!sanitizedPrompt) {
      return res.status(400).json({ error: 'Sanitized prompt is required' });
    }

    if (!ai) {
      return res.status(503).json({
        error: 'Gemini API is not configured on server',
        fallback: true,
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: sanitizedPrompt,
      config: {
        systemInstruction: systemInstruction || 'You are an expert AI assistant. Provide helpful, accurate analysis based strictly on the provided context.',
        temperature: 0.7,
      },
    });

    return res.json({
      success: true,
      rawResponseText: response.text || '',
      modelUsed: 'gemini-3.8-flash',
      promptTokensEstimated: Math.ceil(sanitizedPrompt.length / 4),
      completionTokensEstimated: Math.ceil((response.text?.length || 0) / 4),
    });
  } catch (err: any) {
    console.error('Error executing sanitized prompt:', err);
    return res.status(500).json({
      error: err.message || 'Failed to execute query with Gemini',
      fallback: true,
    });
  }
});

// Setup Vite in development or static serve in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
