import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false).notNull(),
  verificationCode: text('verification_code'),
  verificationCodeExpiresAt: integer('verification_code_expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  data: text('data').notNull(), // JSON string of ProjectDocument
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
