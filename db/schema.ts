import {sqliteTable,text} from "drizzle-orm/sqlite-core";
export const records=sqliteTable("records",{key:text("key").primaryKey(),value:text("value").notNull()});

import {integer} from 'drizzle-orm/sqlite-core';
export const authLimits=sqliteTable('auth_limits',{key:text('key').primaryKey(),attempts:integer('attempts').notNull(),windowEnd:integer('window_end').notNull()});
