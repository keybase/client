import type * as RPCTypes from './types/rpc-gen'

export const waitingKeyBotSearchFeatured = 'bots:search:featured'
export const waitingKeyBotSearchUsers = 'bots:search:users'

export const getFeaturedSorted = (
  featuredBotsMap: Map<string, RPCTypes.FeaturedBot>
): Array<RPCTypes.FeaturedBot> => {
  const featured = [...featuredBotsMap.values()]
  featured.sort((a: RPCTypes.FeaturedBot, b: RPCTypes.FeaturedBot) => {
    if (a.rank < b.rank) {
      return 1
    } else if (a.rank > b.rank) {
      return -1
    }
    return 0
  })
  return featured
}
