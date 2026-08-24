import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userWorkspaces = sqliteTable("user_workspaces", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  objectKey: text("object_key").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
