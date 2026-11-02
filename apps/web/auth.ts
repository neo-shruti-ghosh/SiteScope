import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@sitescope/db";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { LoginSchema } from "@/lib/auth-schemas";

const credentials = Credentials({
  credentials: { email: {}, password: {} },
  authorize: async (raw) => {
    const parsed = LoginSchema.safeParse(raw);
    if (!parsed.success) return null;

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user?.passwordHash) return null;

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    return valid ? { id: user.id, email: user.email, name: user.name, image: user.image } : null;
  },
});

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const providers: Provider[] = googleEnabled ? [credentials, Google] : [credentials];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Credentials sign-in only works with JWT sessions; the API also decodes this token.
  session: { strategy: "jwt" },
  providers,
  pages: { signIn: "/login" },
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: { ...session.user, id: token.sub ?? "" },
    }),
  },
});
