import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  uuid,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const householdMemberRoleEnum = pgEnum("household_member_role", ["owner", "member"]);
export const accountKindEnum = pgEnum("account_kind", ["bank", "super", "brokerage", "cash"]);
export const categoryKindEnum = pgEnum("category_kind", ["income", "expense", "savings"]);
export const transactionSourceEnum = pgEnum("transaction_source", ["manual", "document"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "confirmed", "rejected"]);
export const documentTypeEnum = pgEnum("document_type", ["bill", "payslip", "dividend", "statement", "other"]);
export const documentStatusEnum = pgEnum("document_status", ["uploaded", "processing", "extracted", "failed"]);
export const extractionProviderEnum = pgEnum("extraction_provider", ["gemini", "anthropic"]);

// Auth tables (required by Auth.js Drizzle adapter)
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// Application tables
export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  baseCurrency: text("base_currency").notNull().default("AUD"),
  timezone: text("timezone").notNull().default("Australia/Sydney"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const householdMembers = pgTable("household_members", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  role: householdMemberRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
});

export const financialAccounts = pgTable("financial_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: accountKindEnum("kind").notNull().default("bank"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: categoryKindEnum("kind").notNull(),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon"),
  parentId: uuid("parent_id"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  month: date("month").notNull(), // YYYY-MM-01
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  uploadedByUserId: text("uploaded_by_user_id").notNull().references(() => users.id),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type").notNull(),
  originalFilename: text("original_filename").notNull(),
  type: documentTypeEnum("type").notNull().default("other"),
  status: documentStatusEnum("status").notNull().default("uploaded"),
  error: text("error"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { mode: "date" }),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => financialAccounts.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  // Signed cents: positive = income/inflow, negative = expense/outflow
  amountCents: integer("amount_cents").notNull(),
  occurredAt: timestamp("occurred_at", { mode: "date" }).notNull(),
  description: text("description"),
  merchant: text("merchant"),
  source: transactionSourceEnum("source").notNull().default("manual"),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  status: transactionStatusEnum("status").notNull().default("confirmed"),
  extractedJson: jsonb("extracted_json"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const extractionRuns = pgTable("extraction_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  provider: extractionProviderEnum("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull().default("1"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  householdMembers: many(householdMembers),
  transactions: many(transactions),
  documents: many(documents),
}));

export const householdsRelations = relations(households, ({ many }) => ({
  members: many(householdMembers),
  financialAccounts: many(financialAccounts),
  categories: many(categories),
  budgets: many(budgets),
  transactions: many(transactions),
  documents: many(documents),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  budgets: many(budgets),
  transactions: many(transactions),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
  household: one(households, { fields: [budgets.householdId], references: [households.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  account: one(financialAccounts, { fields: [transactions.accountId], references: [financialAccounts.id] }),
  document: one(documents, { fields: [transactions.documentId], references: [documents.id] }),
  createdBy: one(users, { fields: [transactions.createdByUserId], references: [users.id] }),
}));

export const documentsRelations = relations(documents, ({ many, one }) => ({
  transactions: many(transactions),
  extractionRuns: many(extractionRuns),
  uploadedBy: one(users, { fields: [documents.uploadedByUserId], references: [users.id] }),
}));
