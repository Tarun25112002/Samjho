import { z } from "zod";

/**
 * Cursor pagination, used on every list endpoint that can grow.
 *
 * Deliberately not offset pagination: `OFFSET 40000` on a filtered question
 * table makes Postgres walk every skipped row, and results shift under the
 * reader when rows are inserted. A cursor is stable and indexed.
 */
export const cursorPaginationQuerySchema = z.object({
  /** Opaque — the id of the last item from the previous page. */
  cursor: z.string().optional(),
  /** Capped: an uncapped limit is a denial-of-service vector. */
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>;

export const pageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type PageInfo = z.infer<typeof pageInfoSchema>;

/** Wraps an item schema into a paginated list response body. */
export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    pageInfo: pageInfoSchema,
  });
}

export type Paginated<T> = { items: T[]; pageInfo: PageInfo };
