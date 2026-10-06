// What the coverage marks (src-mark.tsx) record: every mount of a Box2 / ClickableBox call site,
// numbered in order, and which of those instances are still mounted.
export type Coverage = {
  // the latest mount number handed out
  seq: () => number
  // call sites with an instance mounted after mount number `seq` that is still mounted: what a
  // capture taken now shows of what its entry mounted (a loading row replaced before the capture
  // is not in it)
  mountedNowSince: (seq: number) => Array<string>
  // call sites mounted right now
  mounted: () => Array<string>
  mount: (id: string) => () => void
}

export const makeCoverage = (): Coverage => {
  let counter = 0
  // the mount numbers of each call site's live instances
  const live = new Map<string, Set<number>>()
  return {
    mount: id => {
      const n = ++counter
      const instances = live.get(id) ?? new Set<number>()
      instances.add(n)
      live.set(id, instances)
      return () => {
        instances.delete(n)
        if (!instances.size && live.get(id) === instances) live.delete(id)
      }
    },
    mounted: () => [...live.keys()].sort(),
    mountedNowSince: seq => [...live].filter(([, ns]) => [...ns].some(n => n > seq)).map(([id]) => id).sort(),
    seq: () => counter,
  }
}
