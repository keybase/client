// Every reload carries the epoch of the event that asked for it. A cached
// resource joins an in-flight request when that request's epoch is not older
// than its own, and supersedes it otherwise.
//
// The point is the sharing: N mounted consumers of one cache each run their own
// effect in response to a single event (a reconnect, one invalidation
// broadcast), and React commits those effects one at a time. Ordering by "was
// this already on the wire when I asked?" therefore makes every consumer after
// the first supersede its predecessor - N rpcs for one event, N-1 of them
// discarded. Allocating one epoch per event and handing the same number to
// every consumer collapses them onto the first request instead.
let epochCounter = 0

/** allocate an epoch for one event. Call ONCE per event, then share the result */
export const nextReloadEpoch = () => ++epochCounter

/** an unforced load has no event behind it: join whatever is on the wire */
export const joinAnyEpoch = Number.NEGATIVE_INFINITY
