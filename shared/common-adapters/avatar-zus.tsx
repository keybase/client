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
    resetState: 'default'
  }
}

export const useAvatarState = Z.createZustand<State>(set => {
  const dispatch: State['dispatch'] = {
    replace: m => {
      set(s => {
        s.counts = m
      })
    },
    resetState: 'default',
    updated: key => {
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
