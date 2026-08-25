"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useMemo, useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Date",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

type Scope = "filter" | "all"

/**
 * Export options dialog for the payments table.
 * Lets ops pick columns and scope; card last-four is off by default.
 *
 * @param filterQuery the current filter query string, used for the current-filter scope.
 * @param filterCount rows in the current filter.
 * @param allCount rows across all payments.
 */
export function ExportDialog({
  filterQuery,
  filterCount,
  allCount,
}: {
  filterQuery: string
  filterCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<Set<ExportColumn>>(
    () =>
      new Set(
        (Object.keys(COLUMN_LABELS) as ExportColumn[]).filter(
          (c) => c !== "last4",
        ),
      ),
  )
  const [scope, setScope] = useState<Scope>("filter")

  const selectedColumns = useMemo(
    () =>
      (Object.keys(COLUMN_LABELS) as ExportColumn[]).filter((c) =>
        columns.has(c),
      ),
    [columns],
  )

  const toggle = (column: ExportColumn) => {
    setColumns((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const downloadHref = useMemo(() => {
    const params = new URLSearchParams(
      scope === "filter" ? filterQuery : "",
    )
    params.set("columns", selectedColumns.join(","))
    params.set("scope", scope)
    return `/api/payments/export?${params.toString()}`
  }, [scope, selectedColumns, filterQuery])

  const count = scope === "filter" ? filterCount : allCount
  const disabled = selectedColumns.length === 0

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose which columns are included and which payments are exported.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <fieldset className="grid grid-cols-2 gap-x-6 gap-y-3">
            <legend className="mb-1 col-span-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {(Object.keys(COLUMN_LABELS) as ExportColumn[]).map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  checked={columns.has(column)}
                  onChange={() => toggle(column)}
                  className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </fieldset>
          <fieldset className="mt-6 flex flex-col gap-3">
            <legend className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="filter"
                checked={scope === "filter"}
                onChange={() => setScope("filter")}
                className="size-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
              />
              Current filter ({filterCount.toLocaleString()} payments)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
              />
              All payments ({allCount.toLocaleString()} payments)
            </label>
          </fieldset>
          <p className="mt-6 text-sm text-gray-500">
            {disabled
              ? "Select at least one column to download."
              : `${count.toLocaleString()} payments will be exported.`}
          </p>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {disabled ? (
            <Button variant="primary" className="py-1.5" disabled>
              Download
            </Button>
          ) : (
            <DrawerClose asChild>
              <Button variant="primary" className="py-1.5" asChild>
                <a href={downloadHref}>Download</a>
              </Button>
            </DrawerClose>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
