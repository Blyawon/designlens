/* ---------------------------------------------------------------
   GET /api/report/:id  — retrieve saved audit report
   --------------------------------------------------------------- */

import { NextRequest } from "next/server";
import { getReport } from "@/lib/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    return Response.json({ error: "Report not found." }, { status: 404 });
  }

  return Response.json(report);
}
