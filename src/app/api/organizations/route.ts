import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/components/auth/auth";
import { v4 as uuidv4 } from "uuid";
import { driver, convertNeo4jTypes } from "@/lib/neo4j";

// GET: Fetch user's organizations and teams
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const dbSession = driver.session();

    // Fetch organizations and teams for the user
    const result = await dbSession.run(
      `
      MATCH (u:User {id: $userId})
      OPTIONAL MATCH (u)-[:OWNS]->(ownedOrg:Organization)
      OPTIONAL MATCH (ownedOrg)-[:HAS_TEAM]->(ownedTeam:Team)
      OPTIONAL MATCH (u)<-[:HAS_MEMBER]-(memberTeam:Team)<-[:HAS_TEAM]-(memberOrg:Organization)
      
      WITH u, 
           collect(DISTINCT {
             id: ownedOrg.id,
             name: ownedOrg.name,
             createdAt: ownedOrg.createdAt,
             role: 'owner'
           }) as ownedOrgs,
           collect(DISTINCT {
             id: memberOrg.id,
             name: memberOrg.name,
             createdAt: memberOrg.createdAt,
             role: 'member'
           }) as memberOrgs
      
      UNWIND (ownedOrgs + memberOrgs) as org
      
      MATCH (o:Organization {id: org.id})-[:HAS_TEAM]->(t:Team)
      OPTIONAL MATCH (t)-[:HAS_MEMBER]->(m:User)
      
      RETURN org, 
             collect(DISTINCT {
               id: t.id,
               name: t.name,
               createdAt: t.createdAt,
               memberCount: COUNT { (t)-[:HAS_MEMBER]->(:User) }
             }) as teams
      ORDER BY org.createdAt DESC
      `,
      { userId: session.user.id },
    );

    const organizations = result.records.map((record) => {
      const org = convertNeo4jTypes(record.get("org")) as {
        id: string;
        name: string;
        createdAt: string;
        role: string;
      };
      const teams = convertNeo4jTypes(record.get("teams")) as Array<{
        id: string;
        name: string;
        createdAt: string;
        memberCount: number;
      }>;
      return {
        ...org,
        teams,
      };
    });

    // Remove duplicates based on organization id
    const uniqueOrganizations = organizations.reduce(
      (acc, org) => {
        const existing = acc.find((o) => o.id === org.id);
        if (!existing) {
          acc.push(org);
        }
        return acc;
      },
      [] as {
        id: string;
        name: string;
        createdAt: string;
        role: string;
        teams: {
          id: string;
          name: string;
          createdAt: string;
          memberCount: number;
        }[];
      }[],
    );

    await dbSession.close();

    return NextResponse.json({ organizations: uniqueOrganizations });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { message: "Failed to fetch organizations" },
      { status: 500 },
    );
  }
}

// POST: Create a new organization
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name) {
      return NextResponse.json(
        { message: "Organization name is required" },
        { status: 400 },
      );
    }

    const dbSession = driver.session();
    const orgId = uuidv4();
    const teamId = uuidv4();

    // Create organization with default "Owners Team"
    const result = await dbSession.run(
      `
      MATCH (u:User {id: $userId})
      CREATE (o:Organization {
        id: $orgId,
        name: $name,
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
        userId: session.user.id,
        orgId,
        teamId,
        name,
      },
    );

    await dbSession.close();

    const createdOrg = convertNeo4jTypes(result.records[0].get("o").properties);
    const createdTeam = convertNeo4jTypes(
      result.records[0].get("t").properties,
    );

    return NextResponse.json(
      {
        message: "Organization created successfully",
        organization: {
          ...createdOrg,
          role: "owner",
          teams: [
            {
              ...createdTeam,
              memberCount: 1,
            },
          ],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { message: "Failed to create organization" },
      { status: 500 },
    );
  }
}
