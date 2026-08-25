/**
 * Card number generation and checking.
 * Test BIN only: nothing this file produces may resemble a real PAN.
 */

export const TEST_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

const DIGITS_ONLY = /^\d+$/

function luhnSum(digits: string): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let value = digits.charCodeAt(i) - 48
    if ((digits.length - 1 - i) % 2 === 1) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
  }
  return sum
}

/** Luhn check digit for a number missing its final digit. NaN on non-digits. */
export function luhnCheckDigit(withoutCheckDigit: string): number {
  if (!DIGITS_ONLY.test(withoutCheckDigit)) return NaN
  return (10 - (luhnSum(withoutCheckDigit + "0") % 10)) % 10
}

export function isValidLuhn(cardNumber: string): boolean {
  if (!DIGITS_ONLY.test(cardNumber)) return false
  return luhnSum(cardNumber) % 10 === 0
}

/** Server-side only. 16 digits on the 4242 test BIN with a valid check digit. */
export function generateCardNumber(): string {
  let body = TEST_BIN
  while (body.length < CARD_NUMBER_LENGTH - 1) {
    body += Math.floor(Math.random() * 10)
  }
  return body + luhnCheckDigit(body)
}
