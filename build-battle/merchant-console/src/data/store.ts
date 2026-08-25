import { generate } from "./generate"
import { merchants } from "./merchants"
import { Dispute, Payment, Payout, Refund, VirtualCard } from "./types"

/**
 * In-memory store, generated once at boot.
 *
 * Writes vanish on restart by design; persistence is NWP-203. Held on
 * globalThis so dev-server module reloading does not hand out a fresh copy.
 */

interface Store {
  merchants: typeof merchants
  payments: Payment[]
  refunds: Refund[]
  disputes: Dispute[]
  payouts: Payout[]
  cards: VirtualCard[]
}

declare global {
  // eslint-disable-next-line no-var
  var __northwindStore: Store | undefined
}

function createStore(): Store {
  const { payments, refunds, disputes, payouts, cards } = generate()
  return { merchants, payments, refunds, disputes, payouts, cards }
}

export const store: Store = globalThis.__northwindStore ?? createStore()

if (process.env.NODE_ENV !== "production") {
  globalThis.__northwindStore = store
}
