import { describe, expect, it } from "vitest"
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
