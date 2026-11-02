import type { Metadata } from "next";
import { googleEnabled } from "@/auth";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return <AuthForm mode="login" googleEnabled={googleEnabled} />;
}
