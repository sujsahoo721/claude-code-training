import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { SpendProgress } from "@/components/ui/cards/SpendProgress"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardStatus, VirtualCard } from "@/data/types"
import { CARD_CATEGORY_LABELS, maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../card-status-actions"

type CardEvent = { at: string; from: CardStatus | null; to: CardStatus; note: string }

export default async function CardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const history = ((card as VirtualCard & { history?: CardEvent[] }).history ?? [])
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at))

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )

  return (
    <div className="p-4 sm:p-6">
      <Link href="/cards" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50">← All cards</Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{card.nickname}</h1>
        <CardStatusBadge status={card.status} />
        <CardStatusActions cardId={card.id} status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">{card.id}</p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">{merchant.name}<span className="ml-2 text-gray-500">{merchant.country}</span></Field>
        <Field label="Card number"><span className="font-mono text-sm">{maskCardNumber(card.last4)}</span></Field>
        <Field label="Reference"><span className="font-mono text-sm">{card.reference}</span></Field>
        <Field label="Spend limit">{formatMoney(card.spendLimit, card.currency)}<span className="ml-2 text-gray-500">{card.currency}</span></Field>
        <Field label="Spent">{formatMoney(card.spend, card.currency)}</Field>
        <Field label="Category">{card.category ? CARD_CATEGORY_LABELS[card.category] : "No category lock"}</Field>
        <Field label="Created (UTC)"><span className="font-mono text-sm">{card.createdAt}</span></Field>
        <Field label={`Created (${merchant.timezone})`}>{formatInZone(card.createdAt, merchant.timezone)}</Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Spend against limit</h2>
      <div className="mt-4 max-w-lg">
        <SpendProgress spend={card.spend} spendLimit={card.spendLimit} currency={card.currency} />
      </div>

      {history.length > 0 && (
        <>
          <Divider />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Timeline</h2>
          <ol className="mt-4 space-y-4">
            {history.map((event, index) => (
              <li key={index} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
                <div>
                  <p className="text-sm text-gray-900 dark:text-gray-50">{event.note}</p>
                  <p className="text-sm text-gray-500">{formatInZone(event.at, merchant.timezone)}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
