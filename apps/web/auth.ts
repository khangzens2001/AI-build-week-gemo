import { isDevAuthEnabled } from "@event/core";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

/**
 * Auth.js / NextAuth v5 (App Router). Google is the real provider; a dev-only
 * Credentials provider ("mock account") lets us test authed flows in the browser
 * without Google OAuth. The dev provider is gated by `isDevAuthEnabled()` and is
 * NEVER present in production.
 *
 * The app derives a stable `user.id`: for Google it's the account id
 * (`providerAccountId` → `googleSub`); for the mock account it's a fixed id so
 * the same seeded test user is reused across sessions.
 * Env (Google, auto-detected): AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET.
 */

/** Fixed identity for the seeded "mock account" (matches the seeded users row). */
export const MOCK_USER = {
  id: "mock-builder",
  email: "builder@cue.dev",
  name: "Demo Builder",
  image: null as string | null,
};

const devProviders = isDevAuthEnabled()
  ? [
      Credentials({
        id: "mock",
        name: "Mock account (dev)",
        credentials: {},
        // No real check — this only exists in non-production builds.
        authorize: () => ({ ...MOCK_USER }),
      }),
    ]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Credentials requires JWT sessions (no DB adapter). Set explicitly.
  session: { strategy: "jwt" },
  providers: [Google, ...devProviders],
  callbacks: {
    jwt({ token, account, user }) {
      if (account?.provider === "google") {
        token.googleSub = account.providerAccountId;
      }
      // Mock account: carry the fixed id + email on the token at sign-in.
      if (account?.provider === "mock" && user) {
        token.googleSub = (user as { id?: string }).id ?? MOCK_USER.id;
        token.email = (user as { email?: string }).email ?? MOCK_USER.email;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.googleSub ?? token.sub ?? "");
      if (token.email) session.user.email = String(token.email);
      return session;
    },
  },
});
