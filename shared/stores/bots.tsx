import * as T from '@/constants/types'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as Z from '@/util/zustand'
import {ignorePromise, RPCError, isNetworkErr} from '@/constants/utils'
import * as S from '@/constants/strings'
import logger from '@/logger'

type BotSearchResults = {
  bots: ReadonlyArray<T.RPCGen.FeaturedBot>
  users: ReadonlyArray<string>
}

type Store = T.Immutable<{
  featuredBotsPage: number
  featuredBotsLoaded: boolean
  featuredBotsMap: Map<string, T.RPCGen.FeaturedBot>
  botSearchResults: Map<string, BotSearchResults | undefined> // Keyed so that we never show results that don't match the user's input (e.g. outdated results)
}>

const initialStore: Store = {
  botSearchResults: new Map(),
  featuredBotsLoaded: false,
  featuredBotsMap: new Map(),
  featuredBotsPage: -1,
}

export interface State extends Store {
  dispatch: {
    getFeaturedBots: (limit?: number, page?: number) => void
    loadNextBotPage: (pageSize?: number) => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: 'default'
    searchFeaturedAndUsers: (query: string) => void
    searchFeaturedBots: (query: string, limit?: number, offset?: number) => void
    setLoadedAllBots: (loaded: boolean) => void
    setLoadedBotPage: (page: number) => void
    setSearchFeaturedAndUsersResults: (query: string, results?: BotSearchResults) => void
    updateFeaturedBots: (bots: ReadonlyArray<T.RPCGen.FeaturedBot>, page?: number) => void
  }
}

const pageSize = 100
export const useBotsState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    getFeaturedBots: (limit, page) => {
      const f = async () => {
        try {
          const {bots} = await T.RPCGen.featuredBotFeaturedBotsRpcPromise({
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
      ignorePromise(f())
    },
    loadNextBotPage: ps => {
      get().dispatch.getFeaturedBots(ps ?? pageSize, get().featuredBotsPage + 1)
    },
    onEngineIncomingImpl: (action: EngineGen.Actions) => {
      switch (action.type) {
        case EngineGen.keybase1NotifyFeaturedBotsFeaturedBotsUpdate:
          {
            const {bots, limit, offset} = action.payload.params
            const loadedAllBots = !bots || bots.length < pageSize
            const page = offset / limit
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
        let botRes: T.RPCGen.SearchRes | undefined
        let userRes: ReadonlyArray<T.RPCGen.APIUserSearchResult> | undefined
        try {
          const temp = await Promise.all([
            T.RPCGen.featuredBotSearchRpcPromise(
              {limit: 10, offset: 0, query},
              S.waitingKeyBotsSearchFeatured
            ),
            T.RPCGen.userSearchUserSearchRpcPromise(
              {
                includeContacts: false,
                includeServicesSummary: false,
                maxResults: 10,
                query,
                service: 'keybase',
              },
              S.waitingKeyBotsSearchUsers
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
          bots: botRes.bots || [],
          users: (userRes ?? []).reduce<Array<string>>((l, r) => {
            const username = r.keybase?.username
            if (username) {
              l.push(username)
            }
            return l
          }, []),
        })
      }
      ignorePromise(f())
    },
    searchFeaturedBots: (query, limit, offset) => {
      const f = async () => {
        try {
          const {bots} = await T.RPCGen.featuredBotSearchRpcPromise({
            limit: limit ?? 10,
            offset: offset ?? 0,
            query,
          })
          if (!bots || bots.length === 0) {
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
      ignorePromise(f())
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
        s.botSearchResults.set(query, T.castDraft(results))
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
