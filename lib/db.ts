import {env} from 'cloudflare:workers';
export function db(){const d=(env as unknown as {DB:D1Database}).DB;if(!d)throw new Error('Storage unavailable');return d;}
export function bucket(){return (env as unknown as {BUCKET:R2Bucket}).BUCKET;}
