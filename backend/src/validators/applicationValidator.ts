import { z } from 'zod';

const idParam = z.string().uuid('A valid id is required');

export const applicationCreateSchema = z.object({
  body: z
    .object({
      scholarshipId: idParam,
      status: z
        .enum(['INTERESTED', 'PREPARING', 'READY_TO_APPLY', 'APPLIED', 'INTERVIEW', 'ACCEPTED', 'REJECTED'])
        .optional(),
      notes: z.string().trim().max(5000, 'Notes must be 5000 characters or fewer').optional(),
    })
    .strip(),
});

/**
 * Status is an enum in the domain but a plain String column in SQLite, so without
 * validation any arbitrary value lands in the database and then renders as an
 * unknown Kanban column in the tracker UI.
 */
export const applicationStatusSchema = z.object({
  params: z.object({ id: idParam }),
  body: z
    .object({
      status: z.enum(['INTERESTED', 'PREPARING', 'READY_TO_APPLY', 'APPLIED', 'INTERVIEW', 'ACCEPTED', 'REJECTED']),
      notes: z.string().trim().max(5000).optional(),
    })
    .strip(),
});

export const applicationUpdateSchema = z.object({
  params: z.object({ id: idParam }),
  body: z
    .object({
      status: z
        .enum(['INTERESTED', 'PREPARING', 'READY_TO_APPLY', 'APPLIED', 'INTERVIEW', 'ACCEPTED', 'REJECTED'])
        .optional(),
      notes: z.string().trim().max(5000).optional(),
      submissionDate: z.string().trim().datetime({ offset: true }).or(z.string().trim().date()).nullable().optional(),
    })
    .strip()
    .refine((d) => Object.keys(d).length > 0, 'At least one field must be provided'),
});

export const applicationIdSchema = z.object({
  params: z.object({ id: idParam }),
});

export const checklistIdSchema = z.object({
  params: z.object({ checklistId: idParam }),
});

export const checklistCreateSchema = z.object({
  params: z.object({ id: idParam }),
  body: z
    .object({
      item: z.string().trim().min(1, 'Checklist item text is required').max(300),
      dueDate: z.string().trim().datetime({ offset: true }).or(z.string().trim().date()).nullable().optional(),
    })
    .strip(),
});
