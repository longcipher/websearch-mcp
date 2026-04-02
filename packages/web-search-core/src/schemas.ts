import type { Dispatcher } from 'undici';
import { z } from 'zod';

export const ContentKindSchema = z.enum([
  'github_issue',
  'github_discussion',
  'stackexchange',
  'wikipedia',
  'arxiv',
  'generic_html',
  'unknown',
]);

export type ContentKind = z.infer<typeof ContentKindSchema>;

export const FetchStatusSchema = z.enum([
  'ok',
  'timeout',
  'error',
  'not_requested',
  'anti_bot_block',
  'unsupported_content',
]);

export type FetchStatus = z.infer<typeof FetchStatusSchema>;

export const SearchResultSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  summary: z.string().optional(),
  source_providers: z.array(z.string()),
  content_kind: ContentKindSchema,
  fetch_status: FetchStatusSchema,
  page_content: z.string().optional(),
});

export type SearchResult = {
  url: string;
  title: string;
  summary?: string | undefined;
  source_providers: string[];
  content_kind: ContentKind;
  fetch_status: FetchStatus;
  page_content?: string | undefined;
};

export const SearchResponseSchema = z.object({
  query: z.string(),
  num_results: z.number().int().nonnegative(),
  results: z.array(SearchResultSchema),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const FetchResponseSchema = z.object({
  url: z.string().url(),
  content_kind: ContentKindSchema,
  fetch_status: FetchStatusSchema,
  content_length: z.number().int().nonnegative(),
  content: z.string(),
});

export type FetchResponse = z.infer<typeof FetchResponseSchema>;

export const SearchInputSchema = z.object({
  query: z.string().min(1),
  num_results: z.number().int().positive().default(10),
  include_page_content: z.boolean().default(false),
  max_enriched_results: z.number().int().nonnegative().default(0),
});

export type SearchInput = z.infer<typeof SearchInputSchema>;

export const FetchInputSchema = z.object({
  url: z.string().url(),
  max_char_size: z.number().int().positive().default(50000),
});

export type FetchInput = z.infer<typeof FetchInputSchema>;

export interface ResolvedContent {
  url: string;
  content_kind: ContentKind;
  content: string;
  title?: string | undefined;
}

export interface ResolveContext {
  timeoutMs: number;
  maxChars: number;
  dispatcher?: Dispatcher | undefined;
}

export interface ContentResolver {
  canHandle(url: URL): boolean;
  resolve(url: URL, context: ResolveContext): Promise<ResolvedContent | null>;
}
