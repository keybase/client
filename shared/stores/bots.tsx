import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import * as Z from '@/util/zustand'

type Store = T.Immutable<{
  featuredBotsMap: Map<string, T.RPCGen.FeaturedBot>
}>

const initialStore: Store = {
  featuredBotsMap: new Map(),
}

export type State = Store & {
  dispatch: {
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: () => void
    updateFeaturedBots: (bots: ReadonlyArray<T.RPCGen.FeaturedBot>) => void
  }
}

export const useBotsState = Z.createZustand<State>('bots', (set, get) => {
  const dispatch: State['dispatch'] = {
    onEngineIncomingImpl: (action: EngineGen.Actions) => {
      switch (action.type) {
        case 'keybase.1.NotifyFeaturedBots.featuredBotsUpdate':
          {
            const {bots} = action.payload.params
            get().dispatch.updateFeaturedBots(bots ?? [])
          }
          break
        default:
      }
    },
    resetState: Z.defaultReset,
    updateFeaturedBots: bots => {
      set(s => {
        bots.forEach(b => s.featuredBotsMap.set(b.botUsername, b))
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})

export const getFeaturedSorted = (
  featuredBotsMap: ReadonlyMap<string, T.RPCGen.FeaturedBot>
): Array<T.RPCGen.FeaturedBot> => {
  const featured = [...featuredBotsMap.values()]
  featured.sort((a: T.RPCGen.FeaturedBot, b: T.RPCGen.FeaturedBot) => {
    if (a.rank < b.rank) {
      return 1
    } else if (a.rank > b.rank) {
      return -1
    }
    return 0
  })
  return featured
}
