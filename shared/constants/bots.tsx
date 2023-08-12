import * as RPCTypes from './types/rpc-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Z from '../util/zustand'
import logger from '../logger'
import {RPCError, isNetworkErr} from '../util/errors'

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

type BotSearchResults = {
  bots: Array<RPCTypes.FeaturedBot>
  users: Array<string>
}

type Store = {
  featuredBotsPage: number
  featuredBotsLoaded: boolean
  featuredBotsMap: Map<string, RPCTypes.FeaturedBot>
  botSearchResults: Map<string, BotSearchResults | undefined> // Keyed so that we never show results that don't match the user's input (e.g. outdated results)
}

const initialStore: Store = {
  botSearchResults: new Map(),
  featuredBotsLoaded: false,
  featuredBotsMap: new Map(),
  featuredBotsPage: -1,
}

type State = Store & {
  dispatch: {
    getFeaturedBots: (limit?: number, page?: number) => void
    loadNextBotPage: (pageSize?: number) => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    resetState: 'default'
    searchFeaturedAndUsers: (query: string) => void
    searchFeaturedBots: (query: string, limit?: number, offset?: number) => void
    setLoadedAllBots: (loaded: boolean) => void
    setLoadedBotPage: (page: number) => void
    setSearchFeaturedAndUsersResults: (query: string, results?: BotSearchResults) => void
    updateFeaturedBots: (bots: Array<RPCTypes.FeaturedBot>, page?: number) => void
  }
}

const pageSize = 100
export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    getFeaturedBots: (limit, page) => {
      const f = async () => {
        try {
          const {bots} = await RPCTypes.featuredBotFeaturedBotsRpcPromise({
            limit: limit ?? pageSize,
            offset: (page ?? 0) * (limit ?? pageSize),
            skipCache: false,
          })
          const loadedAllBots = !bots || bots.length < pageSize
          get().dispatch.updateFeaturedBots(bots ?? [], page)
          get().dispatch.setLoadedAllBots(loadedAllBots)
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          if (isNetworkErr(error.code)) {
            logger.info('Network error getting featured bots')
          } else {
            logger.info(error.message)
          }
        }
      }
      Z.ignorePromise(f())
    },
    loadNextBotPage: ps => {
      get().dispatch.getFeaturedBots(ps ?? pageSize, get().featuredBotsPage + 1)
    },
    onEngineIncoming: (action: EngineGen.Actions) => {
      switch (action.type) {
        case EngineGen.keybase1NotifyFeaturedBotsFeaturedBotsUpdate:
          {
            const {bots, limit, offset} = action.payload.params
            const loadedAllBots = !bots || bots.length < pageSize
            const page = offset / (limit ?? pageSize)
            get().dispatch.updateFeaturedBots(bots ?? [], page)
            get().dispatch.setLoadedAllBots(loadedAllBots)
          }
          break
        default:
      }
    },
    resetState: 'default',
    searchFeaturedAndUsers: query => {
      const f = async () => {
        let botRes: RPCTypes.SearchRes | undefined
        let userRes: Array<RPCTypes.APIUserSearchResult> | undefined
        try {
          const temp = await Promise.all([
            RPCTypes.featuredBotSearchRpcPromise({limit: 10, offset: 0, query}, waitingKeyBotSearchFeatured),
            RPCTypes.userSearchUserSearchRpcPromise(
              {
                includeContacts: false,
                includeServicesSummary: false,
                maxResults: 10,
                query,
                service: 'keybase',
              },
              waitingKeyBotSearchUsers
            ),
          ])
          botRes = temp[0]
          userRes = temp[1] ?? undefined
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.info(`searchFeaturedAndUsers: failed to run search: ${error.message}`)
          return
        }
        get().dispatch.setSearchFeaturedAndUsersResults(query, {
          bots: botRes?.bots || [],
          users: (userRes ?? []).reduce<Array<string>>((l, r) => {
            const username = r?.keybase?.username
            if (username) {
              l.push(username)
            }
            return l
          }, []),
        })
      }
      Z.ignorePromise(f())
    },
    searchFeaturedBots: (query, limit, offset) => {
      const f = async () => {
        try {
          const {bots} = await RPCTypes.featuredBotSearchRpcPromise({
            limit: limit ?? 10,
            offset: offset ?? 0,
            query,
          })
          if (!bots || bots.length == 0) {
            // don't do anything with a bad response from rpc
            return
          }
          get().dispatch.updateFeaturedBots(bots)
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          if (isNetworkErr(error.code)) {
            logger.info('Network error searching featured bots')
          } else {
            logger.info(error.message)
          }
        }
      }
      Z.ignorePromise(f())
    },
    setLoadedAllBots: loaded => {
      set(s => {
        s.featuredBotsLoaded = loaded
      })
    },
    setLoadedBotPage: page => {
      set(s => {
        s.featuredBotsPage = page
      })
    },
    setSearchFeaturedAndUsersResults: (query, results) => {
      set(s => {
        s.botSearchResults.set(query, results)
      })
    },
    updateFeaturedBots: (bots, page) => {
      set(s => {
        bots.map(b => s.featuredBotsMap.set(b.botUsername, b))
        if (page !== undefined) {
          s.featuredBotsPage = page
        }
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
