import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { Neo4jAdapter } from "@auth/neo4j-adapter";
import bcrypt from "bcrypt";
import { Session } from "next-auth";
import { JWT } from "next-auth/jwt";
import { v4 as uuidv4 } from "uuid";
import { driver } from "@/lib/neo4j";

// Helper function to create organization and team for new users
async function createOrganizationAndTeam(userId: string, userName: string) {
  const session = driver.session();
  try {
    const orgId = uuidv4();
    const teamId = uuidv4();

    await session.run(
      `
      MATCH (u:User {id: $userId})
      CREATE (o:Organization {
        id: $orgId,
        name: $orgName,
        createdAt: datetime(),
        createdBy: $userId
      })
      CREATE (t:Team {
        id: $teamId,
        name: "Owners Team",
        createdAt: datetime(),
        createdBy: $userId
      })
      CREATE (o)-[:HAS_TEAM]->(t)
      CREATE (t)-[:HAS_MEMBER]->(u)
      CREATE (u)-[:OWNS]->(o)
      RETURN o, t
      `,
      {
        userId,
        orgId,
        teamId,
        orgName: `${userName}'s Organization`,
      },
    );
  } finally {
    await session.close();
  }
}

// Extend the Session and JWT types to include our custom properties
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: Neo4jAdapter(driver.session()),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const session = driver.session();
          const result = await session.run(
            `MATCH (u:User {email: $email}) RETURN u`,
            { email: credentials.email },
          );

          await session.close();

          if (result.records.length === 0) {
            return null;
          }

          const user = result.records[0].get("u").properties;

          // Use bcrypt to compare the provided password with the stored hash
          const passwordMatch = await bcrypt.compare(
            credentials.password,
            user.password,
          );

          if (passwordMatch) {
            return {
              id: user.id,
              name: user.name,
              email: user.email,
            };
          }

          return null;
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
    newUser: "/auth/signup", // Redirect new users to the sign-up page
  },
  callbacks: {
    async signIn({ user, account }) {
      // Handle all users - check if they need organizations created
      if (user.name && user.id) {
        try {
          // Check if user already has an organization
          const session = driver.session();
          const orgCheck = await session.run(
            `MATCH (u:User {id: $userId})-[:OWNS]->(o:Organization) RETURN count(o) as orgCount`,
            { userId: user.id },
          );

          const orgCount = orgCheck.records[0]?.get("orgCount").toNumber() || 0;
          await session.close();

          // If user has no organizations, create one (for both new and existing users)
          if (orgCount === 0) {
            await createOrganizationAndTeam(user.id, user.name);
            console.log(
              `Created organization for existing user: ${user.name} (${account?.provider || "credentials"})`,
            );
          }
        } catch (error) {
          console.error(
            `Error creating organization for user ${user.name}:`,
            error,
          );
          // Don't prevent sign-in if organization creation fails
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account && user) {
        token.accessToken = account.access_token;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token && session.user) {
        session.user.id = token.id;
        // Add access token to the session
        session.accessToken = token.accessToken;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "your-secret-key",
};
