import { Currency } from "@/data/types"
import { isSpendWarning, spendPercentage } from "@/lib/cards"
import { cx } from "@/lib/utils"
import { formatMoney } from "@/lib/money"

const WIDTHS = ["w-[0%]", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]", "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]", "w-[55%]", "w-[60%]", "w-[65%]", "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-[100%]"]

export function SpendProgress({ spend, spendLimit, currency }: { spend: number; spendLimit: number; currency: Currency }) {
  const percentage = spendPercentage(spend, spendLimit)
  const warning = isSpendWarning(spend, spendLimit)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm tabular-nums text-gray-900 dark:text-gray-50">
          <span className="font-medium">{formatMoney(spend, currency)}</span>
          <span className="text-gray-500"> of {formatMoney(spendLimit, currency)}</span>
        </p>
        <p className={cx("text-sm font-medium tabular-nums", warning ? "text-amber-600 dark:text-amber-500" : "text-gray-500")}>
          {percentage}%
        </p>
      </div>

      <div role="progressbar" aria-label="Spend against limit" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div className={cx("h-full rounded-full", WIDTHS[Math.round(percentage / 5)], warning ? "bg-amber-500 dark:bg-amber-500" : "bg-blue-500 dark:bg-blue-500")} />
      </div>

      {warning && <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">This card has used {percentage}% of its limit.</p>}
    </div>
  )
}
