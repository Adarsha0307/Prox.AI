import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false).notNull(),
  verificationCode: text('verification_code'),
  verificationCodeExpiresAt: integer('verification_code_expires_at', { mode: 'timestamp' }),
  credits: integer('credits').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  data: text('data').notNull(), // JSON string of ProjectDocument
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const usageLogs = sqliteTable('usage_logs', {
  id: text('id').primaryKey(), // uuid
  userId: integer('user_id').references(() => users.id).notNull(),
  operation: text('operation').notNull(), // 'outline', 'image', etc.
  provider: text('provider'), // e.g., 'openai', 'anthropic', 'mock'
  model: text('model'), // e.g., 'gpt-4o'
  fundingSource: text('funding_source').notNull(), // 'byok', 'platform'
  executionMode: text('execution_mode').notNull(), // 'live', 'mock'
  status: text('status').notNull(), // 'success', 'error', 'uncertain'
  providerRequestId: text('provider_request_id'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  imageCount: integer('image_count'),
  platformCreditsReserved: integer('platform_credits_reserved'),
  platformCreditsCharged: integer('platform_credits_charged'),
  estimatedCost: integer('estimated_cost'),
  costStatus: text('cost_status'),
  currency: text('currency'),
  pricingVersion: text('pricing_version'),
  errorCode: text('error_code'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
