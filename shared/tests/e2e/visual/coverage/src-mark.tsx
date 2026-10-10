// Runtime half of the visual-gate coverage transform (babel-plugin.cjs): each wrapped Box2 /
// ClickableBox call site records its mount here. Only bundled when KB_VISUAL_COVERAGE=1.
import * as React from 'react'

type Coverage = {
  // the latest mount number handed out
  seq: () => number
  // call sites that mounted after mount number `seq`, whether or not they are still mounted
  mountedSince: (seq: number) => Array<string>
  // call sites mounted right now
  mounted: () => Array<string>
  mount: (id: string) => () => void
}

const makeCoverage = (): Coverage => {
  let counter = 0
  const lastMount = new Map<string, number>()
  const live = new Map<string, number>()
  return {
    mount: id => {
      lastMount.set(id, ++counter)
      live.set(id, (live.get(id) ?? 0) + 1)
      return () => {
        const n = (live.get(id) ?? 0) - 1
        if (n > 0) live.set(id, n)
        else live.delete(id)
      }
    },
    mounted: () => [...live.keys()].sort(),
    mountedSince: seq => [...lastMount].filter(([, s]) => s > seq).map(([id]) => id).sort(),
    seq: () => counter,
  }
}

// kept on the global so a hot reload of this module keeps what was recorded
const g = globalThis as {__kbVisualCoverage?: Coverage}
const coverage = (g.__kbVisualCoverage ??= makeCoverage())

export const KbSrcMark = ({id, children}: {id: string; children: React.ReactNode}): React.ReactNode => {
  React.useLayoutEffect(() => coverage.mount(id), [id])
  return children
}
