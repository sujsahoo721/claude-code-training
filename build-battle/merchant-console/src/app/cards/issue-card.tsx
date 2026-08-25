"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { CARD_CATEGORIES } from "@/data/cards"
import { Currency, MerchantCategory, VirtualCard } from "@/data/types"
import { CARD_CATEGORY_LABELS, maskCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useState } from "react"

const NO_CATEGORY = "none"

type MerchantOption = { id: string; name: string; currency: Currency }
type Issued = { card: VirtualCard; fullNumber: string }

export function IssueCard({
  merchants,
}: {
  merchants: MerchantOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [category, setCategory] = useState<string>(NO_CATEGORY)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  )

  const selectedMerchant = merchants.find((m) => m.id === merchantId)
  const currency = selectedMerchant?.currency ?? null

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCategory(NO_CATEGORY)
    setPending(false)
    setError(null)
    setIssued(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      const revealed = Boolean(issued)
      reset()
      if (revealed) router.refresh()
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!currency) {
      setError("Pick a merchant first.")
      return
    }

    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) {
      setError("Enter a limit as an amount like 250.00.")
      return
    }

    setPending(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          category: category === NO_CATEGORY ? null : (category as MerchantCategory),
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body?.message ?? "Could not issue the card.")
        return
      }
      setIssued(body as Issued)
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full py-1.5 sm:w-fit">Issue card</Button>
      </DrawerTrigger>
      <DrawerContent>
        {issued ? (
          <Reveal issued={issued} merchants={merchants} onDone={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                The card number is generated when you submit and shown once.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              <div>
                <label
                  htmlFor="nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend — Q3"
                  required
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="merchantId"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="merchantId" className="mt-2">
                    <SelectValue placeholder="Pick a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="spendLimit"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit
                </label>
                <Input
                  id="spendLimit"
                  name="spendLimit"
                  inputMode="decimal"
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  placeholder="250.00"
                  required
                  className="mt-2"
                />
                <p className="mt-1 text-sm text-gray-500">
                  A normal amount, such as 250.00.
                </p>
                {currency && (
                  <p
                    id="card-currency"
                    className="mt-1 text-sm text-gray-500"
                  >
                    Settles in {currency}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="mt-2">
                    <SelectValue placeholder="No category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                    {CARD_CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CARD_CATEGORY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-md bg-red-50 p-3 text-sm text-red-900 ring-1 ring-inset ring-red-600/20 dark:bg-red-400/10 dark:text-red-400 dark:ring-red-400/20"
                >
                  <p className="font-medium">Card not issued</p>
                  <p className="mt-1">{error}</p>
                </div>
              )}
            </DrawerBody>

            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                className="mt-2 w-full sm:mt-0 sm:w-fit"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending} className="w-full sm:w-fit">
                {pending ? "Issuing…" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function Reveal({
  issued,
  merchants,
  onDone,
}: {
  issued: Issued
  merchants: MerchantOption[]
  onDone: () => void
}) {
  const { card, fullNumber } = issued
  const merchant = merchants.find((m) => m.id === card.merchantId)

  return (
    <div className="flex flex-1 flex-col">
      <DrawerHeader>
        <DrawerTitle>Card issued</DrawerTitle>
        <DrawerDescription>
          This is the only time the full number is shown. Copy it now — reopening the
          card shows {maskCardNumber(card.last4)} and nothing more.
        </DrawerDescription>
      </DrawerHeader>

      <DrawerBody className="space-y-4">
        <div className="rounded-md bg-gray-50 p-4 ring-1 ring-inset ring-gray-200 dark:bg-gray-900 dark:ring-gray-800">
          <p className="text-sm text-gray-500">Card number</p>
          <p className="mt-1 font-mono text-lg font-medium tracking-wider text-gray-900 dark:text-gray-50">
            {fullNumber}
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Nickname</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
              {card.nickname}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Merchant</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
              {merchant?.name ?? card.merchantId}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Spend limit</dt>
            <dd className="mt-1 text-sm tabular-nums text-gray-900 dark:text-gray-50">
              {formatMoney(card.spendLimit, card.currency)} {card.currency}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Shown from now on as</dt>
            <dd className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-50">
              {maskCardNumber(card.last4)}
            </dd>
          </div>
        </dl>
      </DrawerBody>

      <DrawerFooter>
        <Button onClick={onDone} className="w-full sm:w-fit">
          Done
        </Button>
      </DrawerFooter>
    </div>
  )
}
