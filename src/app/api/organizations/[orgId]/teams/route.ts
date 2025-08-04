import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/components/auth/auth";
import { v4 as uuidv4 } from "uuid";
import { driver, convertNeo4jTypes } from "@/lib/neo4j";

// POST: Create a new team within an organization
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();
    const { orgId } = await params;

    if (!name) {
      return NextResponse.json(
        { message: "Team name is required" },
        { status: 400 },
      );
    }

    const dbSession = driver.session();

    // Check if user owns the organization or is a member of it
    const authCheck = await dbSession.run(
      `
      MATCH (u:User {id: $userId})
      MATCH (o:Organization {id: $orgId})
      OPTIONAL MATCH (u)-[:OWNS]->(o)
      OPTIONAL MATCH (u)<-[:HAS_MEMBER]-(t:Team)<-[:HAS_TEAM]-(o)
      RETURN 
        EXISTS((u)-[:OWNS]->(o)) as isOwner,
        EXISTS((u)<-[:HAS_MEMBER]-(t)<-[:HAS_TEAM]-(o)) as isMember
      `,
      { userId: session.user.id, orgId },
    );

    if (authCheck.records.length === 0) {
      await dbSession.close();
      return NextResponse.json(
        { message: "Organization not found" },
        { status: 404 },
      );
    }

    const authResult = authCheck.records[0];
    const isOwner = authResult.get("isOwner");
    const isMember = authResult.get("isMember");

    if (!isOwner && !isMember) {
      await dbSession.close();
      return NextResponse.json(
        {
          message:
            "You don't have permission to create teams in this organization",
        },
        { status: 403 },
      );
    }

    const teamId = uuidv4();

    // Create the team
    const result = await dbSession.run(
      `
      MATCH (o:Organization {id: $orgId})
      CREATE (t:Team {
        id: $teamId,
        name: $name,
        createdAt: datetime(),
        createdBy: $userId
      })
      CREATE (o)-[:HAS_TEAM]->(t)
      RETURN t, o
      `,
      {
        orgId,
        teamId,
        name,
        userId: session.user.id,
      },
    );

    await dbSession.close();

    const createdTeam = convertNeo4jTypes(
      result.records[0].get("t").properties,
    );

    return NextResponse.json(
      {
        message: "Team created successfully",
        team: {
          ...createdTeam,
          memberCount: 0,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating team:", error);
    return NextResponse.json(
      { message: "Failed to create team" },
      { status: 500 },
    );
  }
}

// GET: Fetch teams for an organization
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    const dbSession = driver.session();

    // Check if user has access to the organization
    const authCheck = await dbSession.run(
      `
      MATCH (u:User {id: $userId})
      MATCH (o:Organization {id: $orgId})
      OPTIONAL MATCH (u)-[:OWNS]->(o)
      OPTIONAL MATCH (u)<-[:HAS_MEMBER]-(t:Team)<-[:HAS_TEAM]-(o)
      RETURN 
        EXISTS((u)-[:OWNS]->(o)) as isOwner,
        EXISTS((u)<-[:HAS_MEMBER]-(t)<-[:HAS_TEAM]-(o)) as isMember
      `,
      { userId: session.user.id, orgId },
    );

    if (authCheck.records.length === 0) {
      await dbSession.close();
      return NextResponse.json(
        { message: "Organization not found" },
        { status: 404 },
      );
    }

    const authResult = authCheck.records[0];
    const isOwner = authResult.get("isOwner");
    const isMember = authResult.get("isMember");

    if (!isOwner && !isMember) {
      await dbSession.close();
      return NextResponse.json(
        { message: "You don't have access to this organization" },
        { status: 403 },
      );
    }

    // Fetch teams with member information
    const result = await dbSession.run(
      `
      MATCH (o:Organization {id: $orgId})-[:HAS_TEAM]->(t:Team)
      OPTIONAL MATCH (t)-[:HAS_MEMBER]->(m:User)
      RETURN t, 
             collect({
               id: m.id,
               name: m.name,
               email: m.email
             }) as members
      ORDER BY t.createdAt ASC
      `,
      { orgId },
    );

    const teams = result.records.map((record) => {
      const team = convertNeo4jTypes(record.get("t").properties);
      const members = convertNeo4jTypes(record.get("members")).filter(
        (m: { id: string | null }) => m.id !== null,
      );
      return {
        ...team,
        members,
        memberCount: members.length,
      };
    });

    await dbSession.close();

    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { message: "Failed to fetch teams" },
      { status: 500 },
    );
  }
}
