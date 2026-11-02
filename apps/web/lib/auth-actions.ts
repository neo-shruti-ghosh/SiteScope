"use server";

import { prisma } from "@sitescope/db";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { type FormState, LoginSchema, SignupSchema } from "./auth-schemas";

const formToObject = (formData: FormData) => Object.fromEntries(formData.entries());

export const loginAction = async (_prev: FormState, formData: FormData): Promise<FormState> => {
  const parsed = LoginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
    return {};
  } catch (error) {
    // signIn signals success by throwing a redirect, which must propagate.
    if (error instanceof AuthError) return { error: "Invalid email or password." };
    throw error;
  }
};

export const signupAction = async (_prev: FormState, formData: FormData): Promise<FormState> => {
  const parsed = SignupSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists. Try logging in." };

  await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12) } });

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: "Account created, but sign-in failed. Please log in." };
    throw error;
  }
};

export const googleSignInAction = async () => {
  await signIn("google", { redirectTo: "/dashboard" });
};

export const signOutAction = async () => {
  await signOut({ redirectTo: "/login" });
};
