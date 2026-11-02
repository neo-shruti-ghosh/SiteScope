import type { Metadata } from "next";
import { googleEnabled } from "@/auth";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return <AuthForm mode="signup" googleEnabled={googleEnabled} />;
}
