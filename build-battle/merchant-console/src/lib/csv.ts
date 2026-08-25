import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * `EXPORT_COLUMNS` is the full set the serializer knows how to write. NWP-101
 * lets ops pick a subset; `last4` is excluded from the default selection
 * because the file often goes to a merchant.
 */

export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/** Default selection excludes card last-four so merchant-bound files are clean. */
export const DEFAULT_EXPORT_COLUMNS = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
) as unknown as readonly ExportColumn[]

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * Filename for a payments export. Scope stamps a short label into the name so
 * two exports of different scopes on the same day do not collide. Date stays
 * UTC so the contract is stable across ops users in different timezones.
 *
 * @param options either a Date (legacy) or `{ scope, status?, date? }`.
 * @returns the export filename, e.g. `payments-disputed-2026-08-13.csv`.
 */
export function exportFilename(
  options:
    | Date
    | { date?: Date }
    | { scope: "filter" | "all"; status?: string; date?: Date } = {},
): string {
  const date = (
    options instanceof Date ? options : options.date ?? new Date()
  )
    .toISOString()
    .slice(0, 10)
  if (!(options instanceof Date) && "scope" in options) {
    const status = options.status && options.status !== "all"
      ? options.status
      : undefined
    const scopePart = options.scope === "all" ? "all" : status ?? "filter"
    return `payments-${scopePart}-${date}.csv`
  }
  return `payments-${date}.csv`
}
