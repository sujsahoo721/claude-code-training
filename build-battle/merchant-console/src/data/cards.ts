import { canTransition, cardReference, lastFour } from "@/lib/cards"
import { generateCardNumber } from "@/lib/luhn"
import { merchantById, merchants } from "./merchants"
import { paginate } from "./queries"
import { store } from "./store"
import {
  CardFilters,
  CardStatus,
  Currency,
  MerchantCategory,
  VirtualCard,
} from "./types"

/**
 * The one card query builder. Every list and detail read goes through it.
 * A second implementation is a defect, not a shortcut.
 */

export const CARD_PAGE_SIZE = 20

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly MerchantCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
]

export const CARD_STATUSES: readonly (CardStatus | "all")[] = [
  "all",
  "active",
  "frozen",
  "cancelled",
]

export const MAX_SPEND_LIMIT_MINOR_UNITS = 5_000_000

/** Allowlist parse, mirroring parseFilters in src/data/queries.ts. */
export function parseCardFilters(params: URLSearchParams): CardFilters {
  const status = params.get("status")
  const page = Number(params.get("page") ?? "1")

  return {
    status: CARD_STATUSES.includes(status as CardStatus)
      ? (status as CardStatus)
      : "all",
    merchantId: params.get("merchantId") ?? undefined,
    search: params.get("search") ?? undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

export function queryCards(filters: CardFilters) {
  const { status, merchantId, search } = filters
  const needle = search?.trim().toLowerCase()

  const filtered = store.cards.filter((card) => {
    if (status && status !== "all" && card.status !== status) return false
    if (merchantId && card.merchantId !== merchantId) return false

    if (needle) {
      const merchant = merchantById(card.merchantId)
      const haystack = [card.id, card.nickname, card.last4, merchant?.name ?? ""]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }

    return true
  })

  const sorted = [...filtered].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  return paginate(sorted, filters.page, filters.pageSize ?? CARD_PAGE_SIZE)
}

export function cardById(id: string): VirtualCard | null {
  return store.cards.find((c) => c.id === id) ?? null
}

export interface CreateCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: MerchantCategory | null
}

const MAX_NICKNAME_LENGTH = 60

type ValidationResult =
  | { ok: true; value: CreateCardInput }
  | { ok: false; message: string }

/** Validates untrusted client input against the allowlist. Server-side enforcement. */
export function validateCreateCard(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Request body must be an object." }
  }

  const { nickname, merchantId, spendLimit, currency, category } =
    body as Record<string, unknown>

  if (typeof nickname !== "string" || nickname.trim() === "") {
    return { ok: false, message: "Nickname is required." }
  }
  if (nickname.trim().length > MAX_NICKNAME_LENGTH) {
    return {
      ok: false,
      message: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.`,
    }
  }

  if (typeof merchantId !== "string" || merchantId === "") {
    return { ok: false, message: "Merchant is required." }
  }
  if (!merchants.some((m) => m.id === merchantId)) {
    return { ok: false, message: `Unknown merchant ${merchantId}.` }
  }

  if (typeof spendLimit !== "number" || !Number.isFinite(spendLimit)) {
    return { ok: false, message: "Spend limit must be a number." }
  }
  if (!Number.isInteger(spendLimit)) {
    return { ok: false, message: "Spend limit must be a whole number of cents." }
  }
  if (spendLimit <= 0) {
    return { ok: false, message: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT_MINOR_UNITS) {
    return { ok: false, message: "Spend limit exceeds the maximum of $50,000.00." }
  }

  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return { ok: false, message: `Unsupported currency ${String(currency)}.` }
  }

  if (
    category !== null &&
    category !== undefined &&
    !CARD_CATEGORIES.includes(category as MerchantCategory)
  ) {
    return { ok: false, message: `Unsupported category ${String(category)}.` }
  }

  return {
    ok: true,
    value: {
      nickname: nickname.trim(),
      merchantId,
      spendLimit,
      currency: currency as Currency,
      category: (category ?? null) as MerchantCategory | null,
    },
  }
}

let cardSeq = store.cards.length

/** Creates the card. The full number is returned here and nowhere else, ever. */
export function createCard(input: CreateCardInput): {
  card: VirtualCard
  fullNumber: string
} {
  const fullNumber = generateCardNumber()

  const card: VirtualCard = {
    id: `card_${String(++cardSeq).padStart(4, "0")}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: lastFour(fullNumber),
    reference: cardReference(),
    spendLimit: input.spendLimit,
    spend: 0,
    currency: input.currency,
    status: "active",
    category: input.category,
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)
  return { card, fullNumber }
}

export function setCardStatus(
  id: string,
  next: CardStatus,
):
  | { ok: true; card: VirtualCard }
  | { ok: false; message: string; code: 404 | 409 } {
  const card = cardById(id)
  if (!card) {
    return { ok: false, message: `Card ${id} not found.`, code: 404 }
  }
  if (!canTransition(card.status, next)) {
    return {
      ok: false,
      message: `Cannot move a ${card.status} card to ${next}.`,
      code: 409,
    }
  }

  card.status = next
  return { ok: true, card }
}
