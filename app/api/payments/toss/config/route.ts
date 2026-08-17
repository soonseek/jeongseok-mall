import { NextResponse } from "next/server";
import { getIntegrationSecret } from "@/lib/db/integrations";

export async function GET() {
  const integration = await getIntegrationSecret("TOSS_PAYMENTS", "TEST");
  const clientKey = integration?.status !== "DISABLED" ? integration?.settings.clientKey : null;
  return NextResponse.json({ configured: typeof clientKey === "string" && clientKey.length > 0, clientKey: clientKey ?? null, environment: "TEST" });
}
