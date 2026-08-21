import { z } from 'zod';

/**
 * Password policy: length is the dominant factor for resistance to offline
 * cracking, so the floor is 10 characters with a mixed-character requirement.
 * The 128-char ceiling matters because bcrypt silently truncates at 72 bytes and
 * unbounded input makes hashing a cheap CPU-exhaustion vector.
 */
const passwordField = z
  .string()
  .min(10, 'Password must be at least 10 characters long')
  .max(128, 'Password must be 128 characters or fewer')
  .refine((v) => /[a-z]/.test(v), 'Password must include a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Password must include an uppercase letter')
  .refine((v) => /[0-9]/.test(v), 'Password must include a number');

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Email is required')
  .max(254, 'Email address is too long')
  .email('Enter a valid email address');

export const registerSchema = z.object({
  body: z
    .object({
      email: emailField,
      password: passwordField,
      fullName: z.string().trim().min(1, 'Full name is required').max(120, 'Full name is too long').optional(),
    })
    // Strip unknown keys so a client cannot attempt to set role/isVerified.
    .strip(),
});

export const loginSchema = z.object({
  body: z
    .object({
      email: emailField,
      // Never apply the registration policy here — it would leak the policy and
      // reject legitimate legacy passwords.
      password: z.string().min(1, 'Password is required').max(128),
    })
    .strip(),
});
