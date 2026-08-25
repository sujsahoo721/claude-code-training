import { cardReference, lastFour } from "@/lib/cards"
import { generateCardNumber } from "@/lib/luhn"
import { merchants } from "./merchants"
import {
  CardEvent,
  CardStatus,
  Currency,
  Dispute,
  MerchantCategory,
  Payment,
  PaymentStatus,
  Payout,
  Refund,
  VirtualCard,
} from "./types"

/**
 * Deterministic seed data. Everyone in the room gets identical records,
 * so a bug reproduces the same way on every machine.
 */

const SEED = 20260813
const DAYS = 120
const PAYMENTS_PER_DAY = 14

/** Small, fast, deterministic PRNG. Not for anything that matters. */
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(SEED)
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)]
const between = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min

const DESCRIPTIONS = [
  "Online order",
  "In-store purchase",
  "Subscription renewal",
  "Gift card",
  "Wholesale invoice",
  "Repeat order",
  "Marketplace order",
]

const REASON_CODES = [
  "10.4 Other Fraud",
  "12.6 Duplicate Processing",
  "13.1 Merchandise Not Received",
  "13.3 Not as Described",
  "13.7 Cancelled Merchandise",
]

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

/** The anchor date. Fixed, so "the last 30 days" is stable across runs. */
export const GENERATED_AT = new Date("2026-08-13T00:00:00.000Z")

function statusFor(): PaymentStatus {
  const roll = rand()
  if (roll < 0.78) return "captured"
  if (roll < 0.86) return "authorized"
  if (roll < 0.93) return "refunded"
  if (roll < 0.98) return "failed"
  return "disputed"
}

export function generate() {
  const payments: Payment[] = []
  const refunds: Refund[] = []
  const disputes: Dispute[] = []
  let paymentSeq = 0
  let refundSeq = 0
  let disputeSeq = 0

  for (let day = DAYS - 1; day >= 0; day--) {
    const dayStart = new Date(GENERATED_AT)
    dayStart.setUTCDate(dayStart.getUTCDate() - day)

    const count = between(PAYMENTS_PER_DAY - 5, PAYMENTS_PER_DAY + 5)

    for (let i = 0; i < count; i++) {
      const merchant = pick(merchants)
      const createdAt = new Date(dayStart)
      createdAt.setUTCHours(between(0, 23), between(0, 59), between(0, 59), 0)

      const status = statusFor()
      const method = rand() < 0.82 ? "card" : rand() < 0.6 ? "wallet" : "bank_transfer"
      const amount = between(450, 480_00)

      const payment: Payment = {
        id: `pay_${pad(++paymentSeq)}`,
        merchantId: merchant.id,
        amount,
        currency: merchant.currency as Currency,
        status,
        method,
        cardBrand:
          method === "card" ? pick(["visa", "mastercard", "amex"] as const) : null,
        last4: method === "card" ? String(between(1000, 9999)) : null,
        createdAt: createdAt.toISOString(),
        description: pick(DESCRIPTIONS),
      }
      payments.push(payment)

      if (status === "refunded") {
        const full = rand() < 0.7
        refunds.push({
          id: `re_${pad(++refundSeq)}`,
          paymentId: payment.id,
          amount: full ? amount : Math.floor(amount / 2),
          currency: payment.currency,
          reason: pick([
            "requested_by_customer",
            "duplicate",
            "fraudulent",
          ] as const),
          createdAt: new Date(
            createdAt.getTime() + between(1, 6) * 86_400_000,
          ).toISOString(),
        })
      }

      if (status === "disputed") {
        const openedAt = new Date(createdAt.getTime() + between(2, 10) * 86_400_000)
        disputes.push({
          id: `dp_${pad(++disputeSeq)}`,
          paymentId: payment.id,
          merchantId: merchant.id,
          amount,
          currency: payment.currency,
          reasonCode: pick(REASON_CODES),
          status: pick([
            "needs_response",
            "needs_response",
            "under_review",
            "won",
            "lost",
          ] as const),
          openedAt: openedAt.toISOString(),
          evidenceDueAt: new Date(
            openedAt.getTime() + 14 * 86_400_000,
          ).toISOString(),
        })
      }
    }
  }

  const payouts = generatePayouts(payments)
  const cards = generateCards()
  return { payments, refunds, disputes, payouts, cards }
}

const CARD_SEEDS: readonly {
  nickname: string
  merchantId: string
  spendLimit: number
  spend: number
  status: CardStatus
  category: MerchantCategory | null
  daysAgo: number
}[] = [
  {
    nickname: "Search ads",
    merchantId: "mch_01",
    spendLimit: 250_000,
    spend: 218_400,
    status: "active",
    category: "advertising",
    daysAgo: 74,
  },
  {
    nickname: "Design tooling",
    merchantId: "mch_02",
    spendLimit: 90_000,
    spend: 41_250,
    status: "active",
    category: "software",
    daysAgo: 61,
  },
  {
    nickname: "Warehouse contractors",
    merchantId: "mch_03",
    spendLimit: 400_000,
    spend: 96_000,
    status: "active",
    category: "contractors",
    daysAgo: 52,
  },
  {
    nickname: "Trade show travel",
    merchantId: "mch_04",
    spendLimit: 180_000,
    spend: 174_600,
    status: "frozen",
    category: "travel",
    daysAgo: 45,
  },
  {
    nickname: "Studio utilities",
    merchantId: "mch_05",
    spendLimit: 60_000,
    spend: 23_400,
    status: "active",
    category: "utilities",
    daysAgo: 38,
  },
  {
    nickname: "Retired supplier card",
    merchantId: "mch_06",
    spendLimit: 120_000,
    spend: 119_500,
    status: "cancelled",
    category: null,
    daysAgo: 30,
  },
  {
    nickname: "Analytics subscriptions",
    merchantId: "mch_07",
    spendLimit: 75_000,
    spend: 12_800,
    status: "active",
    category: "software",
    daysAgo: 22,
  },
  {
    nickname: "Courier fuel",
    merchantId: "mch_08",
    spendLimit: 50_000,
    spend: 44_500,
    status: "active",
    category: "contractors",
    daysAgo: 14,
  },
  {
    nickname: "Seasonal campaign",
    merchantId: "mch_09",
    spendLimit: 300_000,
    spend: 0,
    status: "active",
    category: "advertising",
    daysAgo: 5,
  },
]

const SEEDED_NOTES: Record<CardStatus, string> = {
  active: "Card issued.",
  frozen: "Frozen by ops.",
  cancelled: "Cancelled by ops.",
}

/**
 * History consistent with the seed's current status.
 *
 * @param createdAt - When the card was issued.
 * @param status - The card's current status.
 * @param daysAgo - Age of the card in days, bounding the transition timestamp.
 * @returns An issue event, plus one transition event for a frozen or cancelled card.
 */
function seedHistory(
  createdAt: Date,
  status: CardStatus,
  daysAgo: number,
): CardEvent[] {
  const history: CardEvent[] = [
    { at: createdAt.toISOString(), from: null, to: "active", note: "Card issued." },
  ]
  if (status === "active") return history

  const at = new Date(
    createdAt.getTime() + between(1, Math.max(1, daysAgo - 1)) * 86_400_000,
  )
  history.push({
    at: at.toISOString(),
    from: "active",
    to: status,
    note: SEEDED_NOTES[status],
  })
  return history
}

function generateCards(): VirtualCard[] {
  return CARD_SEEDS.map((seed, index) => {
    const merchant = merchants.find((m) => m.id === seed.merchantId)!
    const createdAt = new Date(GENERATED_AT)
    createdAt.setUTCDate(createdAt.getUTCDate() - seed.daysAgo)
    createdAt.setUTCHours(between(0, 23), between(0, 59), between(0, 59), 0)

    return {
      id: `card_${pad(index + 1, 4)}`,
      nickname: seed.nickname,
      merchantId: seed.merchantId,
      last4: lastFour(generateCardNumber()),
      reference: cardReference(rand),
      spendLimit: seed.spendLimit,
      spend: seed.spend,
      currency: merchant.currency,
      status: seed.status,
      category: seed.category,
      createdAt: createdAt.toISOString(),
      history: seedHistory(createdAt, seed.status, seed.daysAgo),
    }
  })
}

function generatePayouts(payments: Payment[]): Payout[] {
  const payouts: Payout[] = []
  let seq = 0

  for (const merchant of merchants) {
    for (let week = 0; week < 8; week++) {
      const periodEnd = new Date(GENERATED_AT)
      periodEnd.setUTCDate(periodEnd.getUTCDate() - week * 7)
      const periodStart = new Date(periodEnd)
      periodStart.setUTCDate(periodStart.getUTCDate() - 7)

      const inPeriod = payments.filter(
        (p) =>
          p.merchantId === merchant.id &&
          p.status === "captured" &&
          p.createdAt >= periodStart.toISOString() &&
          p.createdAt < periodEnd.toISOString(),
      )
      if (inPeriod.length === 0) continue

      const gross = inPeriod.reduce((sum, p) => sum + p.amount, 0)
      const fees = Math.round(gross * 0.029) + inPeriod.length * 30

      payouts.push({
        id: `po_${pad(++seq, 4)}`,
        merchantId: merchant.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        gross,
        fees,
        net: gross - fees,
        currency: merchant.currency,
        status: week === 0 ? "pending" : week === 1 ? "in_transit" : "paid",
        paymentIds: inPeriod.map((p) => p.id),
      })
    }
  }

  return payouts
}
