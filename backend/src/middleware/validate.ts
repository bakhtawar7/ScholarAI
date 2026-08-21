import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * Validates body/query/params against a Zod schema and — importantly — writes the
 * parsed result back onto the request. Without the write-back, coercions, defaults
 * and `.strip()`ped unknown keys are discarded and handlers keep reading the raw
 * client input.
 */
export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as { body?: any; query?: any; params?: any };

      if (parsed.body !== undefined) req.body = parsed.body;
      // req.query / req.params are getter-only on some Express versions; assign
      // defensively so validation never crashes the request.
      if (parsed.query !== undefined) {
        try {
          (req as any).query = parsed.query;
        } catch {
          Object.assign(req.query, parsed.query);
        }
      }
      if (parsed.params !== undefined) {
        try {
          (req as any).params = parsed.params;
        } catch {
          Object.assign(req.params, parsed.params);
        }
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          details: error.errors.map((e) => ({
            field: e.path.filter((p) => p !== 'body' && p !== 'query' && p !== 'params').join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};
