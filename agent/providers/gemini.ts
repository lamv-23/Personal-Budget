import { GoogleGenAI, type FunctionDeclaration, FunctionCallingConfigMode, Type } from "@google/genai";
import type { ExtractionProvider, HouseholdContext, ExtractionResult } from "../provider";
import { SYSTEM_INSTRUCTION } from "../prompts";
import { z } from "zod";

const TransactionSchema = z.object({
  amount_cents: z.number().int().positive(),
  direction: z.enum(["credit", "debit"]),
  description: z.string(),
  occurred_at: z.string().nullable().optional(),
  suggested_category_id: z.string().uuid().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

const ResultSchema = z.object({
  document_type: z.string(),
  issuer: z.string().nullable().optional(),
  document_date: z.string().nullable().optional(),
  transactions: z.array(TransactionSchema),
});

const GEMINI_FUNCTION_SCHEMA: FunctionDeclaration = {
  name: "record_extracted_transactions",
  description:
    "Record the financial transactions extracted from the document. Call this once with all transactions found.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      document_type: {
        type: Type.STRING,
        description: "The type of document: bill, payslip, dividend, statement, receipt, or other",
      },
      issuer: {
        type: Type.STRING,
        description: "The organisation that issued the document",
      },
      document_date: {
        type: Type.STRING,
        description: "Primary date from the document in ISO format YYYY-MM-DD",
      },
      transactions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            amount_cents: {
              type: Type.INTEGER,
              description: "Absolute amount in AUD cents (always positive)",
            },
            direction: {
              type: Type.STRING,
              description: "credit (money in) or debit (money out)",
            },
            description: {
              type: Type.STRING,
              description: "Clear description of this transaction",
            },
            occurred_at: {
              type: Type.STRING,
              description: "Date in ISO format YYYY-MM-DD",
            },
            suggested_category_id: {
              type: Type.STRING,
              description: "UUID of the best matching category from the provided list, or empty string",
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence score 0.0–1.0",
            },
          },
          required: ["amount_cents", "direction", "description", "confidence"],
        },
      },
    },
    required: ["document_type", "transactions"],
  },
};

export const geminiProvider: ExtractionProvider = {
  name: "gemini",
  async extract({ fileBuffer, mimeType, household }) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

    const categoryContext = household.categories
      .map((c) => `${c.id} | ${c.name} | ${c.kind}`)
      .join("\n");

    const contextText = `Available categories (id | name | kind):\n${categoryContext}`;

    const inlineData = {
      data: fileBuffer.toString("base64"),
      mimeType,
    };

    const response = await ai.models.generateContent({
      model,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [GEMINI_FUNCTION_SCHEMA] }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
        },
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: contextText },
            { inlineData },
          ],
        },
      ],
    });

    const candidate = response.candidates?.[0];
    const fnCall = candidate?.content?.parts?.find((p) => p.functionCall)?.functionCall;

    if (!fnCall) {
      throw new Error("Gemini did not return a function call");
    }

    const parsed = ResultSchema.parse(fnCall.args);

    return {
      documentType: parsed.document_type,
      issuer: parsed.issuer ?? null,
      documentDate: parsed.document_date ?? null,
      transactions: parsed.transactions.map((t) => ({
        amountCents: t.amount_cents,
        direction: t.direction,
        description: t.description,
        occurredAt: t.occurred_at ?? parsed.document_date ?? null,
        suggestedCategoryId: t.suggested_category_id ?? null,
        confidence: t.confidence,
      })),
      inputTokens: response.usageMetadata?.promptTokenCount ?? undefined,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? undefined,
      rawResponse: fnCall.args,
    } satisfies ExtractionResult;
  },
};
