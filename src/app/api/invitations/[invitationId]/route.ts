import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/components/auth/auth";
import { driver, convertNeo4jTypes } from "@/lib/neo4j";

// PUT: Accept or reject an invitation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { action } = await request.json(); // 'accept' or 'reject'
    const { invitationId } = await params;

    if (!action || !["accept", "reject"].includes(action)) {
      return NextResponse.json(
        { message: "Invalid action. Must be 'accept' or 'reject'" },
        { status: 400 },
      );
    }

    const dbSession = driver.session();

    // Verify the invitation belongs to the current user and is pending
    const verifyResult = await dbSession.run(
      `
      MATCH (u:User {id: $userId})-[:HAS_INVITATION]->(inv:Invitation {id: $invitationId, status: 'pending'})
      MATCH (inv)-[:FOR_TEAM]->(t:Team)
      MATCH (t)<-[:HAS_TEAM]-(o:Organization)
      RETURN inv, t, o
      `,
      { userId: session.user.id, invitationId },
    );

    if (verifyResult.records.length === 0) {
      await dbSession.close();
      return NextResponse.json(
        { message: "Invitation not found or already processed" },
        { status: 404 },
      );
    }

    const invitation = verifyResult.records[0].get("inv").properties;
    const team = verifyResult.records[0].get("t").properties;
    const organization = verifyResult.records[0].get("o").properties;

    if (action === "accept") {
      // Accept invitation: add user to team and update invitation status
      await dbSession.run(
        `
        MATCH (u:User {id: $userId})-[:HAS_INVITATION]->(inv:Invitation {id: $invitationId})
        MATCH (inv)-[:FOR_TEAM]->(t:Team)
        SET inv.status = 'accepted', inv.respondedAt = datetime()
        CREATE (t)-[:HAS_MEMBER]->(u)
        `,
        { userId: session.user.id, invitationId },
      );

      await dbSession.close();

      return NextResponse.json({
        message: "Invitation accepted successfully",
        invitation: {
          ...convertNeo4jTypes(invitation),
          status: "accepted",
        },
        team: convertNeo4jTypes(team),
        organization: convertNeo4jTypes(organization),
      });
    } else if (action === "reject") {
      // Reject invitation: update invitation status only
      await dbSession.run(
        `
        MATCH (u:User {id: $userId})-[:HAS_INVITATION]->(inv:Invitation {id: $invitationId})
        SET inv.status = 'rejected', inv.respondedAt = datetime()
        `,
        { userId: session.user.id, invitationId },
      );

      await dbSession.close();

      return NextResponse.json({
        message: "Invitation rejected",
        invitation: {
          ...convertNeo4jTypes(invitation),
          status: "rejected",
        },
      });
    }
  } catch (error) {
    console.error("Error processing invitation:", error);
    return NextResponse.json(
      { message: "Failed to process invitation" },
      { status: 500 },
    );
  }
}
