import { cardById, setCardStatus } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { NextRequest, NextResponse } from "next/server"

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found" }, { status: 404 })
  }
  return NextResponse.json(card)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const status = (body as { status?: unknown } | null)?.status
  if (typeof status !== "string" || !STATUSES.includes(status as CardStatus)) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 })
  }

  const result = setCardStatus(id, status as CardStatus)
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.code })
  }
  return NextResponse.json(result.card, { status: 200 })
}
