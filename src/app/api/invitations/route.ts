import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/components/auth/auth";
import { driver, convertNeo4jTypes } from "@/lib/neo4j";

// GET: Fetch user's pending invitations
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const dbSession = driver.session();

    // Fetch user's pending invitations
    const result = await dbSession.run(
      `
      MATCH (u:User {id: $userId})-[:HAS_INVITATION]->(inv:Invitation {status: 'pending'})
      MATCH (inv)-[:FOR_TEAM]->(t:Team)
      MATCH (inv)-[:FROM_USER]->(inviter:User)
      MATCH (t)<-[:HAS_TEAM]-(o:Organization)
      RETURN inv, t, o, inviter
      ORDER BY inv.createdAt DESC
      `,
      { userId: session.user.id },
    );

    const invitations = result.records.map((record) => {
      const invitation = convertNeo4jTypes(record.get("inv").properties);
      const team = convertNeo4jTypes(record.get("t").properties);
      const organization = convertNeo4jTypes(record.get("o").properties);
      const inviter = convertNeo4jTypes(record.get("inviter").properties);

      return {
        ...invitation,
        team: {
          id: team.id,
          name: team.name,
        },
        organization: {
          id: organization.id,
          name: organization.name,
        },
        inviter: {
          id: inviter.id,
          name: inviter.name,
          email: inviter.email,
        },
      };
    });

    await dbSession.close();

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { message: "Failed to fetch invitations" },
      { status: 500 },
    );
  }
}
