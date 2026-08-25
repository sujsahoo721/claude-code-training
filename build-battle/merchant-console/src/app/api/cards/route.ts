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

  const { card, fullNumber } = createCard(result.value)
  return NextResponse.json({ card, fullNumber }, { status: 201 })
}
