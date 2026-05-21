import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { households, householdMembers } from "@/db/schema";
import { seedHousehold } from "@/db/seed";
import { eq } from "drizzle-orm";

const allowedEmails = (process.env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase() ?? "";
      if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
        return false;
      }
      return true;
    },
    async session({ session, user }) {
      // Find or create household for this user
      const membership = await db.query.householdMembers.findFirst({
        where: eq(householdMembers.userId, user.id),
      });

      if (!membership) {
        // Check if there's an existing household (for the second user joining)
        const existingHouseholds = await db.query.households.findMany({ limit: 1 });
        let householdId: string;

        if (existingHouseholds.length > 0) {
          householdId = existingHouseholds[0].id;
        } else {
          const [newHousehold] = await db
            .insert(households)
            .values({ name: "Our Family Budget", baseCurrency: "AUD" })
            .returning();
          householdId = newHousehold.id;
          await seedHousehold(householdId);
        }

        const isFirst = existingHouseholds.length === 0;
        await db.insert(householdMembers).values({
          userId: user.id,
          householdId,
          role: isFirst ? "owner" : "member",
        });

        (session as typeof session & { householdId: string }).householdId = householdId;
      } else {
        (session as typeof session & { householdId: string }).householdId = membership.householdId;
      }

      return session;
    },
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
});
