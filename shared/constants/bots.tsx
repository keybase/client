import * as RPCTypes from './types/rpc-gen'
import * as Z from '../util/zustand'
import * as BotsGen from '../actions/bots-gen'
import * as EngineGen from '../actions/engine-gen-gen'
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

type Store = {}

const initialStore: Store = {}

type State = Store & {
  dispatch: {
    botsUpdate: (action: EngineGen.Keybase1NotifyFeaturedBotsFeaturedBotsUpdatePayload) => void
    getFeaturedBots: (limit?: number, page?: number) => void
    resetState: 'default'
    searchFeaturedAndUsers: (query: string) => void
    searchFeaturedBots: (query: string, limit?: number, offset?: number) => void
  }
}

const pageSize = 100
export const useState = Z.createZustand<State>(_set => {
  // TODO remove when chat is done
  const reduxDispatch = Z.getReduxDispatch()
  const dispatch: State['dispatch'] = {
    botsUpdate: action => {
      const {bots, limit, offset} = action.payload.params
      const loadedAllBots = !bots || bots.length < pageSize
      const page = offset / (limit ?? pageSize)
      return [
        BotsGen.createUpdateFeaturedBots({bots: bots ?? [], page}),
        BotsGen.createSetLoadedAllBots({loaded: loadedAllBots}),
      ]
    },
    getFeaturedBots: (limit, page) => {
      const f = async () => {
        try {
          const {bots} = await RPCTypes.featuredBotFeaturedBotsRpcPromise({
            limit: limit ?? pageSize,
            offset: (page ?? 0) * (limit ?? pageSize),
            skipCache: false,
          })
          const loadedAllBots = !bots || bots.length < pageSize
          reduxDispatch(BotsGen.createUpdateFeaturedBots({bots: bots ?? [], page}))
          reduxDispatch(BotsGen.createSetLoadedAllBots({loaded: loadedAllBots}))
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
        reduxDispatch(
          BotsGen.createSetSearchFeaturedAndUsersResults({
            query,
            results: {
              bots: botRes?.bots || [],
              users: (userRes ?? []).reduce<Array<string>>((l, r) => {
                const username = r?.keybase?.username
                if (username) {
                  l.push(username)
                }
                return l
              }, []),
            },
          })
        )
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
          reduxDispatch(BotsGen.createUpdateFeaturedBots({bots}))
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
  }
  return {
    ...initialStore,
    dispatch,
  }
})
