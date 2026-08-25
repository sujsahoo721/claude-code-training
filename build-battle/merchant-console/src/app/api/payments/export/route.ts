import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  exportFilename,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports payments as CSV with ops-chosen columns and scope.
 * Validates columns and scope against allowlists; reuses the one query builder.
 *
 * @param request inbound GET carrying `columns`, `scope`, and filter query params.
 * @returns a CSV attachment, or 400 JSON when no columns are selected.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const filters = parseFilters(params)

  const columns = parseColumns(params.get("columns"))
  if (columns.length === 0) {
    return NextResponse.json(
      { message: "Select at least one column to export." },
      { status: 400 },
    )
  }

  const scope = params.get("scope") === "all" ? "all" : "filter"
  const rows = sortPayments(
    scope === "all" ? filterPayments({}) : filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  const filename = exportFilename({
    scope,
    status: typeof filters.status === "string" ? filters.status : undefined,
  })

  return new Response(toCsv(rows, columns), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}

/** Columns from the client are checked against the known set; unknowns are dropped. */
function parseColumns(raw: string | null): ExportColumn[] {
  if (!raw) return [...DEFAULT_EXPORT_COLUMNS]
  const requested = raw.split(",").map((c) => c.trim()).filter(Boolean)
  return requested.filter((column): column is ExportColumn =>
    (EXPORT_COLUMNS as readonly string[]).includes(column),
  )
}
