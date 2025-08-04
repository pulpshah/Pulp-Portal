import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import { driver, convertNeo4jTypes } from "@/lib/neo4j";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const session = driver.session();
    const checkResult = await session.run(
      `MATCH (u:User {email: $email}) RETURN u`,
      { email },
    );

    if (checkResult.records.length > 0) {
      await session.close();
      return NextResponse.json(
        { message: "User with this email already exists" },
        { status: 409 },
      );
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user in Neo4j with organization and team
    const userId = uuidv4();
    const orgId = uuidv4();
    const teamId = uuidv4();
    const createResult = await session.run(
      `
      CREATE (u:User {
        id: $id,
        name: $name,
        email: $email,
        password: $password,
        createdAt: datetime()
      })
      CREATE (o:Organization {
        id: $orgId,
        name: $orgName,
        createdAt: datetime(),
        createdBy: $id
      })
      CREATE (t:Team {
        id: $teamId,
        name: "Owners Team",
        createdAt: datetime(),
        createdBy: $id
      })
      CREATE (o)-[:HAS_TEAM]->(t)
      CREATE (t)-[:HAS_MEMBER]->(u)
      CREATE (u)-[:OWNS]->(o)
      RETURN u, o, t
      `,
      {
        id: userId,
        name,
        email,
        password: hashedPassword,
        orgId,
        teamId,
        orgName: `${name}'s Organization`,
      },
    );

    await session.close();

    const createdUser = convertNeo4jTypes(
      createResult.records[0].get("u").properties,
    );

    return NextResponse.json(
      {
        message: "User registered successfully",
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: "An error occurred during registration" },
      { status: 500 },
    );
  }
}
