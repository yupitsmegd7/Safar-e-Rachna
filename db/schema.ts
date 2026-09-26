import {sqliteTable,text,integer,primaryKey,index} from 'drizzle-orm/sqlite-core';
export const settings=sqliteTable('settings',{id:integer('id').primaryKey(),owner:text('owner').notNull(),data:text('data').notNull()});
export const posts=sqliteTable('posts',{id:text('id').primaryKey(),title:text('title').notNull(),category:text('category').notNull(),excerpt:text('excerpt').notNull(),body:text('body').notNull(),tags:text('tags').notNull(),image:text('image').notNull(),date:text('date').notNull(),status:text('status').notNull()});
export const likes=sqliteTable('likes',{post:text('post').notNull(),user:text('user').notNull()},t=>[primaryKey({columns:[t.post,t.user]})]);
export const comments=sqliteTable('comments',{id:text('id').primaryKey(),post:text('post').notNull(),user:text('user').notNull(),name:text('name').notNull(),body:text('body').notNull(),date:text('date').notNull()},t=>[index('idx_comments_post').on(t.post)]);
