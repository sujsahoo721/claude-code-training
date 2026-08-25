import { describe, expect, it } from "vitest"
import {
  CARD_NUMBER_LENGTH,
  TEST_BIN,
  generateCardNumber,
  isValidLuhn,
  luhnCheckDigit,
} from "./luhn"

describe("luhnCheckDigit", () => {
  it("computes the digit that completes a number", () => {
    expect(luhnCheckDigit("7992739871")).toBe(3)
    expect(luhnCheckDigit("42424242424242")).toBe(4)
  })

  it("computes short vectors the same way", () => {
    expect(luhnCheckDigit("1")).toBe(8)
    expect(luhnCheckDigit("18")).toBe(2)
  })

  it("returns NaN for anything that is not digits", () => {
    expect(luhnCheckDigit("4242-4242")).toBeNaN()
    expect(luhnCheckDigit("")).toBeNaN()
  })
})

describe("isValidLuhn", () => {
  it("accepts a number carrying its own check digit", () => {
    expect(isValidLuhn("79927398713")).toBe(true)
    expect(isValidLuhn("4242424242424242")).toBe(true)
  })

  it("rejects a number with a single digit changed", () => {
    expect(isValidLuhn("79927398714")).toBe(false)
    expect(isValidLuhn("79927398723")).toBe(false)
  })

  it("rejects non-digit input rather than throwing", () => {
    expect(isValidLuhn("4242 4242 4242 4242")).toBe(false)
    expect(isValidLuhn("")).toBe(false)
  })
})

describe("generateCardNumber", () => {
  it("always produces a valid sixteen-digit test-BIN number", () => {
    for (let i = 0; i < 200; i++) {
      const number = generateCardNumber()
      expect(number).toHaveLength(CARD_NUMBER_LENGTH)
      expect(number.startsWith(TEST_BIN)).toBe(true)
      expect(isValidLuhn(number)).toBe(true)
    }
  })
})
