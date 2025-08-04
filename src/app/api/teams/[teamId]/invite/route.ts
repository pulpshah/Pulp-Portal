import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/components/auth/auth";
import { driver, convertNeo4jTypes } from "@/lib/neo4j";
import { v4 as uuidv4 } from "uuid";

// POST: Invite user to team by email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { email } = await request.json();
    const { teamId } = await params;

    if (!email) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: "Invalid email format" },
        { status: 400 },
      );
    }

    const dbSession = driver.session();

    // Check if user has permission to invite to this team
    const authCheck = await dbSession.run(
      `
      MATCH (u:User {id: $userId})
      MATCH (t:Team {id: $teamId})
      MATCH (t)<-[:HAS_TEAM]-(o:Organization)
      OPTIONAL MATCH (u)-[:OWNS]->(o)
      OPTIONAL MATCH (u)<-[:HAS_MEMBER]-(ownerTeam:Team {name: "Owners Team"})<-[:HAS_TEAM]-(o)
      RETURN 
        EXISTS((u)-[:OWNS]->(o)) as isOwner,
        EXISTS((u)<-[:HAS_MEMBER]-(ownerTeam)) as isOrgAdmin,
        t.name as teamName,
        o.name as orgName
      `,
      { userId: session.user.id, teamId },
    );

    if (authCheck.records.length === 0) {
      await dbSession.close();
      return NextResponse.json({ message: "Team not found" }, { status: 404 });
    }

    const authResult = authCheck.records[0];
    const isOwner = authResult.get("isOwner");
    const isOrgAdmin = authResult.get("isOrgAdmin");
    const teamName = authResult.get("teamName");
    const orgName = authResult.get("orgName");

    if (!isOwner && !isOrgAdmin) {
      await dbSession.close();
      return NextResponse.json(
        { message: "You don't have permission to invite users to this team" },
        { status: 403 },
      );
    }

    // Check if user exists in the system
    const userCheck = await dbSession.run(
      `
      OPTIONAL MATCH (targetUser:User {email: $email})
      OPTIONAL MATCH (targetUser)-[:HAS_ACCOUNT]->(account:Account)
      WHERE targetUser.email = $email
      RETURN targetUser, account
      `,
      { email },
    );

    let targetUser = null;
    if (userCheck.records.length > 0) {
      const userRecord = userCheck.records[0].get("targetUser");
      const accountRecord = userCheck.records[0].get("account");
      if (userRecord || accountRecord) {
        targetUser = userRecord?.properties || { email };
      }
    }

    if (!targetUser) {
      await dbSession.close();
      return NextResponse.json(
        {
          message:
            "User not found in the system. They need to create an account first.",
        },
        { status: 404 },
      );
    }

    // Check if user is already a member of this team or has pending invitation
    const memberCheck = await dbSession.run(
      `
      MATCH (targetUser:User {email: $email})
      MATCH (t:Team {id: $teamId})
      OPTIONAL MATCH (targetUser)-[:HAS_INVITATION]->(inv:Invitation {status: 'pending'})-[:FOR_TEAM]->(t)
      RETURN 
        EXISTS((targetUser)<-[:HAS_MEMBER]-(t)) as isMember,
        EXISTS((targetUser)-[:HAS_INVITATION]->(inv)-[:FOR_TEAM]->(t)) as hasPendingInvitation
      `,
      { email, teamId },
    );

    if (memberCheck.records.length > 0) {
      const isMember = memberCheck.records[0].get("isMember");
      const hasPendingInvitation = memberCheck.records[0].get(
        "hasPendingInvitation",
      );

      if (isMember) {
        await dbSession.close();
        return NextResponse.json(
          { message: "User is already a member of this team" },
          { status: 400 },
        );
      }

      if (hasPendingInvitation) {
        await dbSession.close();
        return NextResponse.json(
          { message: "User already has a pending invitation to this team" },
          { status: 400 },
        );
      }
    }

    // Create an invitation record
    const invitationId = uuidv4();
    const result = await dbSession.run(
      `
      MATCH (targetUser:User {email: $email})
      MATCH (t:Team {id: $teamId})
      MATCH (inviter:User {id: $inviterId})
      MATCH (t)<-[:HAS_TEAM]-(o:Organization)
      CREATE (inv:Invitation {
        id: $invitationId,
        status: 'pending',
        createdAt: datetime(),
        invitedBy: $inviterId
      })
      CREATE (targetUser)-[:HAS_INVITATION]->(inv)
      CREATE (inv)-[:FOR_TEAM]->(t)
      CREATE (inv)-[:FROM_USER]->(inviter)
      RETURN targetUser, t, o, inv, inviter
      `,
      { email, teamId, invitationId, inviterId: session.user.id },
    );

    await dbSession.close();

    const invitedUser = convertNeo4jTypes(
      result.records[0].get("targetUser").properties,
    );
    const invitation = convertNeo4jTypes(
      result.records[0].get("inv").properties,
    );

    return NextResponse.json(
      {
        message: "Invitation sent successfully",
        invitation: {
          id: invitation.id,
          status: invitation.status,
          createdAt: invitation.createdAt,
        },
        user: {
          id: invitedUser.id,
          name: invitedUser.name,
          email: invitedUser.email,
        },
        team: teamName,
        organization: orgName,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error inviting user to team:", error);
    return NextResponse.json(
      { message: "Failed to invite user to team" },
      { status: 500 },
    );
  }
}

// GET: Get team members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const dbSession = driver.session();

    // Check if user has access to this team
    const authCheck = await dbSession.run(
      `
      MATCH (u:User {id: $userId})
      MATCH (t:Team {id: $teamId})
      MATCH (t)<-[:HAS_TEAM]-(o:Organization)
      OPTIONAL MATCH (u)-[:OWNS]->(o)
      OPTIONAL MATCH (u)<-[:HAS_MEMBER]-(anyTeam:Team)<-[:HAS_TEAM]-(o)
      RETURN 
        EXISTS((u)-[:OWNS]->(o)) as isOwner,
        EXISTS((u)<-[:HAS_MEMBER]-(anyTeam)) as isMember,
        t.name as teamName,
        o.name as orgName
      `,
      { userId: session.user.id, teamId },
    );

    if (authCheck.records.length === 0) {
      await dbSession.close();
      return NextResponse.json({ message: "Team not found" }, { status: 404 });
    }

    const authResult = authCheck.records[0];
    const isOwner = authResult.get("isOwner");
    const isMember = authResult.get("isMember");

    if (!isOwner && !isMember) {
      await dbSession.close();
      return NextResponse.json(
        { message: "You don't have access to this team" },
        { status: 403 },
      );
    }

    // Fetch team members and pending invitations
    const result = await dbSession.run(
      `
      MATCH (t:Team {id: $teamId})
      OPTIONAL MATCH (t)-[:HAS_MEMBER]->(m:User)
      OPTIONAL MATCH (invitedUser:User)-[:HAS_INVITATION]->(inv:Invitation {status: 'pending'})-[:FOR_TEAM]->(t)
      OPTIONAL MATCH (inv)-[:FROM_USER]->(inviter:User)
      RETURN 
        collect(DISTINCT {
          id: m.id,
          name: m.name,
          email: m.email,
          type: 'member'
        }) as members,
        collect(DISTINCT {
          id: invitedUser.id,
          name: invitedUser.name,
          email: invitedUser.email,
          type: 'invited',
          invitationId: inv.id,
          invitedBy: inviter.name,
          invitedAt: inv.createdAt
        }) as invitations
      `,
      { teamId },
    );

    const record = result.records[0];
    const members = convertNeo4jTypes(record.get("members")).filter(
      (m: { id: string | null }) => m.id !== null,
    );
    const invitations = convertNeo4jTypes(record.get("invitations")).filter(
      (i: { id: string | null }) => i.id !== null,
    );

    await dbSession.close();

    return NextResponse.json({ members, invitations });
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json(
      { message: "Failed to fetch team members" },
      { status: 500 },
    );
  }
}
