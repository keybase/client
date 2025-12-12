import * as EngineGen from '@/actions/engine-gen-gen'
import type * as T from '../types'
import {storeRegistry} from '../store-registry'

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyFeaturedBotsFeaturedBotsUpdate:
      {
        storeRegistry.getState('bots').dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}


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
