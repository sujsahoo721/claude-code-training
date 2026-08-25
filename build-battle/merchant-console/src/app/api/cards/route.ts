import { createCard, parseCardFilters, queryCards, validateCreateCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET(request: NextRequest) {
  const filters = parseCardFilters(request.nextUrl.searchParams)
  return NextResponse.json(queryCards(filters))
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const result = validateCreateCard(body)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 400 })
  }

  const idempotencyKey = request.headers.get("Idempotency-Key")
  if (idempotencyKey !== null) {
    if (
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 128 ||
      !/^[A-Za-z0-9_-]+$/.test(idempotencyKey)
    ) {
      return NextResponse.json(
        { message: "Invalid Idempotency-Key header." },
        { status: 400 },
      )
    }
  }

  const { card, fullNumber, replayed } = createCard(
    result.value,
    idempotencyKey ?? undefined,
  )
  return NextResponse.json(
    { card, fullNumber },
    { status: replayed ? 200 : 201 },
  )
}
