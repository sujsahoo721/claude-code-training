"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { canTransition } from "@/lib/cards"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function CardStatusActions({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target: CardStatus | null =
    status === "active" && canTransition(status, "frozen")
      ? "frozen"
      : status === "frozen" && canTransition(status, "active")
        ? "active"
        : null

  if (!target) return null

  const apply = async () => {
    setError(null)
    setPending(true)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.message ?? "Could not update the card.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <Button
        variant="secondary"
        className="py-1"
        disabled={pending}
        onClick={apply}
      >
        {pending
          ? target === "frozen"
            ? "Freezing…"
            : "Unfreezing…"
          : target === "frozen"
            ? "Freeze"
            : "Unfreeze"}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
