export interface HouseholdContext {
  categories: Array<{ id: string; name: string; kind: string }>;
  accounts: Array<{ id: string; name: string; kind: string }>;
}

export interface ExtractedTransaction {
  amountCents: number;
  direction: "credit" | "debit";
  description: string;
  occurredAt: string | null;
  suggestedCategoryId: string | null;
  confidence: number;
}

export interface ExtractionResult {
  documentType: string;
  issuer?: string | null;
  documentDate?: string | null;
  transactions: ExtractedTransaction[];
  inputTokens?: number;
  outputTokens?: number;
  rawResponse?: unknown;
}

export interface ExtractionProvider {
  name: "gemini" | "anthropic";
  extract(input: {
    fileBuffer: Buffer;
    mimeType: string;
    household: HouseholdContext;
  }): Promise<ExtractionResult>;
}
