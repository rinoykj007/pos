import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";



const path = '/api/db-health';



/**
* === [GET] Database Health Check Endpoint ===
* This API checks if the database connection is alive and responsive.
*/
export async function GET() {
  try {
    const mongoDb = await getMongoDb();
    await mongoDb.command({ ping: 1 });

    return NextResponse.json({ message: "MongoDB connection status is ok" }, { status: 200 });
  } catch (e) {
    console.error(`[GET ${path}] Failed to fetch Database Health: `, e)
    return NextResponse.json({ error: "Database connection failed" }, { status: 503 });
  }
}
