import { CardStatus, MerchantCategory } from "@/data/types"

/** Cards are masked everywhere except the one-time creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

export function lastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

const REFERENCE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"

/**
 * Opaque handle for a generated number. Never derived from the number itself.
 *
 * @param random - Source of randomness; injected so seed data stays deterministic.
 * @returns A `cref_` prefixed handle.
 */
export function cardReference(random: () => number = Math.random): string {
  let suffix = ""
  while (suffix.length < 12) {
    suffix += REFERENCE_ALPHABET[Math.floor(random() * REFERENCE_ALPHABET.length)]
  }
  return `cref_${suffix}`
}

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/** active ⇄ frozen, either to cancelled, cancelled is terminal. */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export const SPEND_WARNING_THRESHOLD = 80

/** Display-only percentage. Never stored, never compared as money. */
export function spendPercentage(spend: number, spendLimit: number): number {
  if (spendLimit <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((spend / spendLimit) * 100)))
}

export function isSpendWarning(spend: number, spendLimit: number): boolean {
  return spendPercentage(spend, spendLimit) >= SPEND_WARNING_THRESHOLD
}

export const CARD_CATEGORY_LABELS: Record<MerchantCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}
