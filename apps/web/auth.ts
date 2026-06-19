import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js / NextAuth v5 (App Router). Google-only for the MVP — used purely to
 * identify the builder so reminders/preferences attach to the right user.
 *
 * The app derives a stable `user.id` from the Google account id (`providerAccountId`
 * → `googleSub`) so it stays consistent across sessions without persisting OAuth
 * tokens. Env (auto-detected): AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    jwt({ token, account }) {
      if (account?.provider === "google") {
        token.googleSub = account.providerAccountId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.googleSub ?? token.sub ?? "");
      return session;
    },
  },
});
