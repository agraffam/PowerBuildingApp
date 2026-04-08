import { NextResponse } from "next/server";
import { getAppVersionTicker } from "@/lib/app-version";

export async function GET() {
  return NextResponse.json({ version: getAppVersionTicker() });
}
