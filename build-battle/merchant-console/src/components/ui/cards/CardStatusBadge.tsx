import { Badge } from "@/components/Badge"
import { CardStatus } from "@/data/types"
import { cx } from "@/lib/utils"

const STATUS: Record<CardStatus, { label: string; dot: string; variant: "default" | "neutral" | "success" }> = {
  active: { label: "Active", dot: "bg-emerald-600 dark:bg-emerald-400", variant: "success" },
  frozen: { label: "Frozen", dot: "bg-blue-500 dark:bg-blue-500", variant: "default" },
  cancelled: { label: "Cancelled", dot: "bg-gray-500 dark:bg-gray-500", variant: "neutral" },
}

export function CardStatusBadge({ status }: { status: CardStatus }) {
  const s = STATUS[status]
  return (
    <Badge variant={s.variant} className="rounded-full">
      <span className={cx("size-1.5 shrink-0 rounded-full", s.dot)} aria-hidden="true" />
      {s.label}
    </Badge>
  )
}
