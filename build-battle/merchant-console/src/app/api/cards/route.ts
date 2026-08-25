import { createCard, parseCardFilters, queryCards, validateCreateCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

export function GET(request: NextRequest) {
  return NextResponse.json(queryCards(parseCardFilters(request.nextUrl.searchParams)))
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const result = validateCreateCard(body)
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 })

  const key = request.headers.get("Idempotency-Key")
  if (key !== null && (key.length < 8 || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)))
    return NextResponse.json({ message: "Invalid Idempotency-Key header." }, { status: 400 })

  const { card, fullNumber, replayed } = createCard(result.value, key ?? undefined)
  return NextResponse.json({ card, fullNumber }, { status: replayed ? 200 : 201 })
}
