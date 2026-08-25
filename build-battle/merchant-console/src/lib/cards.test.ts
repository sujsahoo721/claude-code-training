import { describe, expect, it } from "vitest"
import {
  CreateCardInput,
  createCard,
  setCardStatus,
  validateCreateCard,
} from "@/data/cards"
import { store } from "@/data/store"
import { CardStatus } from "@/data/types"
import {
  SPEND_WARNING_THRESHOLD,
  canTransition,
  isSpendWarning,
  lastFour,
  maskCardNumber,
  spendPercentage,
} from "./cards"

describe("maskCardNumber", () => {
  it("renders last four behind dots", () => {
    expect(maskCardNumber("4242")).toBe("•••• 4242")
    expect(maskCardNumber("0007")).toBe("•••• 0007")
  })
})

describe("lastFour", () => {
  it("takes the trailing four digits", () => {
    expect(lastFour("4242424242424242")).toBe("4242")
    expect(lastFour("4242000000001234")).toBe("1234")
  })
})

describe("canTransition", () => {
  const statuses: CardStatus[] = ["active", "frozen", "cancelled"]

  it("allows only the moves the state machine defines", () => {
    const allowed = new Set(["active>frozen", "active>cancelled", "frozen>active", "frozen>cancelled"])
    for (const from of statuses) {
      for (const to of statuses) {
        expect(canTransition(from, to)).toBe(allowed.has(`${from}>${to}`))
      }
    }
  })

  it("rejects same-state moves", () => {
    expect(canTransition("active", "active")).toBe(false)
    expect(canTransition("frozen", "frozen")).toBe(false)
    expect(canTransition("cancelled", "cancelled")).toBe(false)
  })

  it("treats cancelled as terminal", () => {
    expect(canTransition("cancelled", "active")).toBe(false)
    expect(canTransition("cancelled", "frozen")).toBe(false)
  })
})

describe("spendPercentage", () => {
  it("reports whole percentages of the limit", () => {
    expect(spendPercentage(0, 100_000)).toBe(0)
    expect(spendPercentage(25_000, 100_000)).toBe(25)
    expect(spendPercentage(80_000, 100_000)).toBe(80)
    expect(spendPercentage(100_000, 100_000)).toBe(100)
  })

  it("clamps a card that somehow spent past its limit", () => {
    expect(spendPercentage(150_000, 100_000)).toBe(100)
  })

  it("returns zero rather than dividing by a zero limit", () => {
    expect(spendPercentage(5_000, 0)).toBe(0)
    expect(spendPercentage(5_000, -1)).toBe(0)
  })
})

describe("isSpendWarning", () => {
  it("warns from the threshold upward, not before it", () => {
    expect(SPEND_WARNING_THRESHOLD).toBe(80)
    expect(isSpendWarning(79_000, 100_000)).toBe(false)
    expect(isSpendWarning(80_000, 100_000)).toBe(true)
    expect(isSpendWarning(99_000, 100_000)).toBe(true)
  })
})

const issueBody = (over: Record<string, unknown> = {}) => ({
  nickname: "Test card",
  merchantId: "mch_04",
  spendLimit: 50_000,
  currency: "GBP",
  category: "software",
  ...over,
})

describe("validateCreateCard currency", () => {
  it("refuses a currency the merchant does not settle in", () => {
    const result = validateCreateCard(issueBody({ currency: "USD" }))
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toBe(
      "Halcyon Studio settles in GBP, not USD.",
    )
  })

  it("accepts the merchant's own currency", () => {
    expect(validateCreateCard(issueBody()).ok).toBe(true)
  })

  it("keeps the unsupported-currency rejection separate", () => {
    const result = validateCreateCard(issueBody({ currency: "JPY" }))
    expect(result.ok === false && result.message).toBe("Unsupported currency JPY.")
  })

  it("formats the limit cap in the submitted currency", () => {
    const result = validateCreateCard(issueBody({ spendLimit: 5_000_001 }))
    expect(result.ok === false && result.message).toBe(
      "Spend limit exceeds the maximum of £50,000.00.",
    )
  })
})

const input: CreateCardInput = {
  nickname: "Idempotent card",
  merchantId: "mch_04",
  spendLimit: 50_000,
  currency: "GBP",
  category: "software",
}

describe("createCard idempotency", () => {
  it("replays the same card for a repeated key without storing a second", () => {
    const before = store.cards.length
    const first = createCard(input, "key-abc-123")
    const second = createCard(input, "key-abc-123")

    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.card.id).toBe(first.card.id)
    expect(second.fullNumber).toBe(first.fullNumber)
    expect(store.cards.length).toBe(before + 1)
  })

  it("creates separate cards for different keys", () => {
    const first = createCard(input, "key-def-456")
    const second = createCard(input, "key-ghi-789")
    expect(second.card.id).not.toBe(first.card.id)
  })

  it("keeps the full number off the card record", () => {
    const { card, fullNumber } = createCard(input, "key-jkl-012")
    expect(Object.values(card)).not.toContain(fullNumber)
  })
})

describe("card history", () => {
  it("seeds an issue event on creation", () => {
    const { card } = createCard(input)
    expect(card.history).toEqual([
      { at: card.createdAt, from: null, to: "active", note: "Card issued." },
    ])
  })

  it("appends exactly one entry per successful transition", () => {
    const { card } = createCard(input)
    const result = setCardStatus(card.id, "frozen")

    expect(result.ok).toBe(true)
    expect(card.history).toHaveLength(2)
    expect(card.history[1].from).toBe("active")
    expect(card.history[1].to).toBe("frozen")
  })

  it("appends nothing when the transition is refused", () => {
    const { card } = createCard(input)
    const result = setCardStatus(card.id, "active")

    expect(result.ok).toBe(false)
    expect(card.history).toHaveLength(1)
  })

  it("records the issue then the cancel on a cancelled card", () => {
    const { card } = createCard(input)
    setCardStatus(card.id, "cancelled")
    expect(card.history.map((e) => e.to)).toEqual(["active", "cancelled"])
    expect(setCardStatus(card.id, "active").ok).toBe(false)
    expect(card.history).toHaveLength(2)
  })
})
