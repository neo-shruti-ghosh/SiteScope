import { z } from "zod";

export const LoginSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});

export const SignupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

export interface FormState {
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
}
