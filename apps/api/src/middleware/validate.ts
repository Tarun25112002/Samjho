import type { NextFunction, Request, Response } from "express";
import type { z, ZodType } from "zod";

import { ValidationError } from "../lib/errors.js";

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates and *replaces* request parts with their parsed output.
 *
 * Two things worth understanding here:
 *
 *  1. Replacement, not just checking. After this runs, `req.body` is the parsed
 *     value — coerced (`"10"` -> `10`), defaulted, and stripped of unknown keys.
 *     A handler downstream can therefore trust its input completely, which is
 *     the whole point: validation you have to remember to consult is validation
 *     you will eventually forget to consult.
 *
 *  2. It runs before the handler, so no route ever sees unvalidated input.
 *
 * Unused in Phase 0 — no route takes input yet — but it belongs with the other
 * middleware so that the first route that *does* take input has no excuse.
 */
/**
 * Read a validated body with its real type.
 *
 * `req.body` is `any` in Express' types, so a handler needs *something* to turn
 * it into a known shape. The two candidates are a cast and a re-parse.
 *
 * A cast is faster and wrong: `req.body as OnboardingInput` stays compiling
 * after someone deletes the `validate()` call from the route, and the first
 * indication is a service reading `undefined.toLowerCase()`. Re-parsing costs
 * microseconds on objects this size and cannot come apart that way — if the
 * middleware is missing, this throws a ZodError the error handler turns into a
 * 400 rather than letting unvalidated input through.
 *
 * Keep `validate()` on the route as well: it is what produces `body.fieldName`
 * error paths, which is what a form needs to highlight the offending input.
 */
export function parseBody<T extends ZodType>(req: Request, schema: T): z.infer<T> {
  return schema.parse(req.body) as z.infer<T>;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: Array<{ path: string; message: string }> = [];

    for (const key of ["body", "query", "params"] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key]);

      if (result.success) {
        // req.query and req.params are getter-only in Express 5, so assigning
        // directly throws. defineProperty replaces the accessor outright.
        Object.defineProperty(req, key, {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        issues.push(
          ...result.error.issues.map((issue) => ({
            path: [key, ...issue.path].join("."),
            message: issue.message,
          })),
        );
      }
    }

    if (issues.length > 0) {
      next(new ValidationError("Request validation failed", issues));
      return;
    }

    next();
  };
}
