import * as Z from '../util/zustand'

type ZState = {
  counts: Map<string, number>
  updated: (key: string) => void
  // used by remotes to update themselves
  replace: (m: Map<string, number>) => void
}
export const useAvatarState = Z.createZustand(
  Z.immerZustand<ZState>(set => ({
    counts: new Map(),
    replace: (m: Map<string, number>) => {
      set(s => {
        s.counts = m
      })
    },
    updated: (key: string) => {
      set(s => {
        s.counts.set(key, (s.counts.get(key) ?? 0) + 1)
      })
    },
  }))
)
