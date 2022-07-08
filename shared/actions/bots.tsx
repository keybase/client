import * as BotsGen from './bots-gen'
import * as Container from '../util/container'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Constants from '../constants/bots'
import * as EngineGen from './engine-gen-gen'
import logger from '../logger'
import {RPCError} from '../util/errors'

const pageSize = 100

const onFeaturedBotsUpdate = (
  _: unknown,
  action: EngineGen.Keybase1NotifyFeaturedBotsFeaturedBotsUpdatePayload
) => {
  const {bots, limit, offset} = action.payload.params
  const loadedAllBots = !bots || bots.length < pageSize
  const page = offset / (limit ?? pageSize)
  return [
    BotsGen.createUpdateFeaturedBots({bots: bots ?? [], page}),
    BotsGen.createSetLoadedAllBots({loaded: loadedAllBots}),
  ]
}

const getFeaturedBots = async (_: Container.TypedState, action: BotsGen.GetFeaturedBotsPayload) => {
  const {limit, page} = action.payload

  try {
    const {bots} = await RPCTypes.featuredBotFeaturedBotsRpcPromise({
      limit: limit ?? pageSize,
      offset: (page ?? 0) * (limit ?? pageSize),
      skipCache: false,
    })
    const loadedAllBots = !bots || bots.length < pageSize

    return [
      BotsGen.createUpdateFeaturedBots({bots: bots ?? [], page}),
      BotsGen.createSetLoadedAllBots({loaded: loadedAllBots}),
    ]
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    if (Container.isNetworkErr(error.code)) {
      logger.info('Network error getting featured bots')
    } else {
      logger.info(error.message)
    }
    return
  }
}

const searchFeaturedBots = async (_: Container.TypedState, action: BotsGen.SearchFeaturedBotsPayload) => {
  const {limit, offset, query} = action.payload
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
    return BotsGen.createUpdateFeaturedBots({bots})
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    if (Container.isNetworkErr(error.code)) {
      logger.info('Network error searching featured bots')
    } else {
      logger.info(error.message)
    }
    return
  }
}

const searchFeaturedAndUsers = async (_: unknown, action: BotsGen.SearchFeaturedAndUsersPayload) => {
  const {query} = action.payload
  let botRes: RPCTypes.SearchRes | null | undefined
  let userRes: Array<RPCTypes.APIUserSearchResult> | null | undefined
  try {
    ;[botRes, userRes] = await Promise.all([
      RPCTypes.featuredBotSearchRpcPromise(
        {
          limit: 10,
          offset: 0,
          query,
        },
        Constants.waitingKeyBotSearchFeatured
      ),
      RPCTypes.userSearchUserSearchRpcPromise(
        {
          includeContacts: false,
          includeServicesSummary: false,
          maxResults: 10,
          query,
          service: 'keybase',
        },
        Constants.waitingKeyBotSearchUsers
      ),
    ])
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    logger.info(`searchFeaturedAndUsers: failed to run search: ${error.message}`)
    return
  }
  return BotsGen.createSetSearchFeaturedAndUsersResults({
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
}

const initBots = () => {
  Container.listenAction(BotsGen.getFeaturedBots, getFeaturedBots)
  Container.listenAction(BotsGen.searchFeaturedBots, searchFeaturedBots)
  Container.listenAction(BotsGen.searchFeaturedAndUsers, searchFeaturedAndUsers)
  Container.listenAction(EngineGen.keybase1NotifyFeaturedBotsFeaturedBotsUpdate, onFeaturedBotsUpdate)
}

export default initBots
