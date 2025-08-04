import { NextRequest, NextResponse } from "next/server";
import { driver } from "@/lib/neo4j";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { message: "Email parameter is required" },
      { status: 400 },
    );
  }

  try {
    const session = driver.session();

    // First check if the user exists in the User table (credentials provider)
    const userResult = await session.run(
      `MATCH (u:User {email: $email}) RETURN u`,
      { email },
    );

    if (userResult.records.length > 0) {
      await session.close();
      return NextResponse.json({
        exists: true,
        provider: "credentials",
      });
    }

    // Then check if the user exists in the Account table (OAuth providers)
    const accountResult = await session.run(
      `MATCH (u:User)-[:HAS_ACCOUNT]->(a:Account) 
       WHERE u.email = $email
       RETURN a.provider`,
      { email },
    );

    await session.close();

    if (accountResult.records.length > 0) {
      const provider = accountResult.records[0].get("a.provider");
      return NextResponse.json({
        exists: true,
        provider,
      });
    }

    // User doesn't exist
    return NextResponse.json({
      exists: false,
    });
  } catch (error) {
    console.error("Error checking email:", error);
    return NextResponse.json(
      { message: "An error occurred while checking the email" },
      { status: 500 },
    );
  }
}
