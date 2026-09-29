// Tells a thread list's own scrolls from the reader's. The list records the scrolls it starts itself
// and reports the movement it did not make and each time it comes to rest; this turns those into the
// reader's scroll-target events. What moved the list is never read from the input that moved it: any
// movement the list did not make is the reader's, however they scrolled.
//
// The reader's movement takes the end at once. Whether they gave it back is settled only when the list
// comes to rest: at the end after the reader moved it, the end is the list's again. The list's own
// scrolls coming to rest decide nothing, wherever they stop, so the list settling its own position is
// never taken for the reader.
import type {ScrollEvent} from './scroll-target'

// How long a scroll of the list's own counts as in flight when no rest is reported after it.
const ownSettleMs = 1000
// A scroll whose destination is within this many pixels of where the list is moves nothing.
const stillPx = 1

export type OwnScrolls = {
  // The list starts a scroll of its own from offset from (undefined when it does not know where it
  // is) toward offset to: its destination, or only an offset past it in the same direction when the
  // list does not know where it will land exactly, or undefined when it knows neither. Its movement toward there until the list next comes to rest
  // is the list's, and the rest that follows is the list's too, whatever the reader moved before it.
  // A scroll whose destination is where the list already is moves nothing, so there is nothing in
  // flight and no rest will follow it. Returns whether it moves.
  issued: (from: number | undefined, to: number | undefined) => boolean
  // Whether the list moving from offset from to offset now is a scroll of its own in flight: one is,
  // and the movement heads its way. The reader moving it the other way is the reader.
  carries: (from: number, now: number) => boolean
  // The list moved without moving itself, or scrolls on the reader's behalf (the composer's page keys).
  readerMoved: () => ScrollEvent
  // The list came to rest. Returns the end handed back, if the reader's movement brought it there.
  rested: (atEnd: boolean) => ScrollEvent | undefined
}

export const makeOwnScrolls = (): OwnScrolls => {
  let ownUntil = 0
  let ownTo: number | undefined
  let readerMoving = false
  return {
    carries: (from, now) => {
      if (Date.now() >= ownUntil) return false
      return ownTo === undefined || Math.sign(now - from) === Math.sign(ownTo - from)
    },
    issued: (from, to) => {
      if (from !== undefined && to !== undefined && Math.abs(to - from) <= stillPx) return false
      ownUntil = Date.now() + ownSettleMs
      ownTo = to
      readerMoving = false
      return true
    },
    readerMoved: () => {
      readerMoving = true
      return {type: 'userScrolled'}
    },
    rested: atEnd => {
      const reader = readerMoving
      ownUntil = 0
      readerMoving = false
      return reader && atEnd ? {type: 'readerAtEnd'} : undefined
    },
  }
}
