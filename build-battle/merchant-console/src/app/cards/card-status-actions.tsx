"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
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

  const canCancel = canTransition(status, "cancelled")
  if (!target && !canCancel) return null

  const apply = async (next: CardStatus) => {
    setError(null)
    setPending(true)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
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

  const targetLabel =
    target === "frozen" ? "Freeze" : target === "active" ? "Unfreeze" : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {target && (
        <Button
          variant="secondary"
          className="py-1"
          disabled={pending}
          onClick={() => apply(target)}
        >
          {pending
            ? target === "frozen"
              ? "Freezing…"
              : "Unfreezing…"
            : targetLabel}
        </Button>
      )}
      {canCancel && (
        <CancelAction
          cardId={cardId}
          pending={pending}
          onCancel={() => apply("cancelled")}
        />
      )}
      {error && (
        <p role="alert" className="basis-full text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

function CancelAction({
  cardId,
  pending,
  onCancel,
}: {
  cardId: string
  pending: boolean
  onCancel: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const confirm = () => {
    setConfirmOpen(false)
    onCancel()
  }

  return (
    <Drawer open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DrawerTrigger asChild>
        <Button variant="destructive" className="py-1" disabled={pending}>
          Cancel
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Cancel this card?</DrawerTitle>
          <DrawerDescription>
            Cancelling is permanent. The card cannot be reactivated, and any
            remaining spend access is revoked immediately.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody />
        <DrawerFooter>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-fit"
            onClick={() => setConfirmOpen(false)}
          >
            Keep card
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-fit"
            disabled={pending}
            onClick={confirm}
            aria-label={`Cancel card ${cardId} permanently`}
          >
            {pending ? "Cancelling…" : "Cancel card permanently"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
