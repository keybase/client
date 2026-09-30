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

// How long a scroll of the list's own counts as in flight at most when it neither reaches its
// destination nor comes to rest: an instant one that lands short (clamped to an extent that has not
// caught up with new rows), or one heading somewhere it cannot say exactly.
const ownSettleMs = 1000
// The same for an animated one, which takes as long as its animation does.
const ownAnimatedSettleMs = 3000
// A scroll whose destination is within this many pixels of where the list is moves nothing.
const stillPx = 1

type Flight = {
  animated: boolean
  // For an animated scroll, which way it set off: where it lands is measured ahead and can be off,
  // so its movement is the list's for as long as it keeps heading that way.
  heading: number | undefined
  to: number
  until: number
}

export type OwnScrolls = {
  // The list starts a scroll of its own from offset from (undefined when it does not know where it
  // is) toward offset to: its destination, or only which way it lies (±Infinity) when the list does
  // not know where it will land exactly. A scroll whose destination the list does not know at all is
  // not recorded, so the movement after it is the reader's. The movement toward to is the list's until
  // the scroll arrives (an instant one), comes to rest, or runs out of time, and the rest that follows
  // is the list's too, whatever the reader moved before it. A scroll whose destination is where the
  // list already is moves nothing, so there is nothing in flight and no rest will follow it. Returns
  // whether it moves.
  issued: (from: number | undefined, to: number, animated: boolean) => boolean
  // Whether the list moving from offset from to offset now is a scroll of its own in flight: one is,
  // and the movement heads its way. The reader moving it the other way is the reader.
  carries: (from: number, now: number) => boolean
  // The list moved without moving itself, or scrolls on the reader's behalf (the composer's page keys).
  readerMoved: () => ScrollEvent
  // The list came to rest. Returns the end handed back, if the reader's movement brought it there.
  rested: (atEnd: boolean) => ScrollEvent | undefined
}

export const makeOwnScrolls = (): OwnScrolls => {
  let flight: Flight | undefined
  let readerMoving = false
  return {
    carries: (from, now) => {
      if (!flight) return false
      if (Date.now() >= flight.until) {
        flight = undefined
        return false
      }
      const {animated, heading, to} = flight
      if (animated) return Math.sign(now - from) === (heading ?? Math.sign(to - from))
      if (Math.sign(now - from) !== Math.sign(to - from)) return false
      // Arrived, or carried past where it was going: the movement is its own, and it is done.
      if (Math.abs(to - now) <= stillPx || Math.sign(to - now) !== Math.sign(to - from)) flight = undefined
      return true
    },
    issued: (from, to, animated) => {
      if (from !== undefined && Math.abs(to - from) <= stillPx) return false
      flight = {
        animated,
        heading: from === undefined ? undefined : Math.sign(to - from),
        to,
        until: Date.now() + (animated ? ownAnimatedSettleMs : ownSettleMs),
      }
      readerMoving = false
      return true
    },
    readerMoved: () => {
      readerMoving = true
      return {type: 'userScrolled'}
    },
    rested: atEnd => {
      const reader = readerMoving
      flight = undefined
      readerMoving = false
      return reader && atEnd ? {type: 'readerAtEnd'} : undefined
    },
  }
}
