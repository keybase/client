import * as Z from '../util/zustand'

type Store = {
  counts: Map<string, number>
}

const initialStore: Store = {
  counts: new Map(),
}

type State = Store & {
  dispatch: {
    updated: (key: string) => void
    // used by remotes to update themselves
    replace: (m: Map<string, number>) => void
    resetState: () => void
  }
}

export const useAvatarState = Z.createZustand(
  Z.immerZustand<State>(set => {
    const dispatch = {
      replace: (m: Map<string, number>) => {
        set(s => {
          s.counts = m
        })
      },
      resetState: () => {
        set(s => ({...s, ...initialStore}))
      },
      updated: (key: string) => {
        set(s => {
          s.counts.set(key, (s.counts.get(key) ?? 0) + 1)
        })
      },
    }
    return {
      ...initialStore,
      dispatch,
    }
  })
)
