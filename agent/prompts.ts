export const SYSTEM_INSTRUCTION = `You are a financial document analyser for an Australian family budget app.

Your task is to extract structured financial transactions from uploaded documents such as:
- Payslips (PAYG, including gross pay, net pay, tax withheld, super contributions)
- Utility bills (electricity, gas, water, internet)
- Dividend statements (including franking credits)
- Bank/credit card statements
- Receipts and invoices

IMPORTANT RULES:
1. Always use Australian date format awareness (DD/MM/YYYY is common on AU documents)
2. All amounts must be in AUD cents (multiply dollars by 100, round to nearest cent)
3. For payslips: create separate transactions for net pay (income), tax withheld (expense), and super (savings)
4. For dividend statements: include the net dividend as income, franking credits as a separate income line if present
5. For bills: the amount due is an expense
6. Direction: "credit" for money coming in, "debit" for money going out
7. Confidence: 0.0–1.0 how confident you are in each extracted transaction
8. Use the provided category list to suggest the best matching category_id
9. If no category matches well, leave suggested_category_id as null
10. Extract the document date (statement date, due date, pay date) as the primary date
11. For multi-line bills with multiple charges, prefer a single summary transaction unless lines are clearly different categories

You must always call the record_extracted_transactions function with your results.`;

export const FUNCTION_SCHEMA = {
  name: "record_extracted_transactions",
  description:
    "Record the financial transactions extracted from the document. Call this once with all transactions found.",
  parameters: {
    type: "object",
    properties: {
      document_type: {
        type: "string",
        enum: ["bill", "payslip", "dividend", "statement", "receipt", "other"],
        description: "The type of financial document",
      },
      issuer: {
        type: "string",
        description: "The organisation that issued the document (e.g. 'Origin Energy', 'Woolworths')",
      },
      document_date: {
        type: "string",
        description: "Primary date from the document in ISO format YYYY-MM-DD",
      },
      transactions: {
        type: "array",
        items: {
          type: "object",
          required: ["amount_cents", "direction", "description", "confidence"],
          properties: {
            amount_cents: {
              type: "integer",
              description: "Absolute amount in AUD cents (always positive)",
            },
            direction: {
              type: "string",
              enum: ["credit", "debit"],
              description: "credit = money in, debit = money out",
            },
            description: {
              type: "string",
              description: "Clear description of this transaction",
            },
            occurred_at: {
              type: "string",
              description: "Date in ISO format YYYY-MM-DD (use document_date if specific date unknown)",
            },
            suggested_category_id: {
              type: "string",
              description: "UUID of the best matching category from the provided list, or null",
              nullable: true,
            },
            confidence: {
              type: "number",
              description: "Confidence score 0.0–1.0",
            },
          },
        },
      },
    },
    required: ["document_type", "transactions"],
  },
};
