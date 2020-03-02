import * as BotsGen from './bots-gen'
import * as Saga from '../util/saga'
import * as Container from '../util/container'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Constants from '../constants/bots'
import * as EngineGen from './engine-gen-gen'
import logger from '../logger'
import {RPCError} from 'util/errors'

const pageSize = 100

const onFeaturedBotsUpdate = (action: EngineGen.Keybase1NotifyFeaturedBotsFeaturedBotsUpdatePayload) => {
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
  } catch (e) {
    const err: RPCError = e
    if (Container.isNetworkErr(err.code)) {
      logger.info('Network error getting featured bots')
    } else {
      logger.info(err.message)
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
  } catch (e) {
    const err: RPCError = e
    if (Container.isNetworkErr(err.code)) {
      logger.info('Network error searching featured bots')
    } else {
      logger.info(err.message)
    }
    return
  }
}

const searchFeaturedAndUsers = async (action: BotsGen.SearchFeaturedAndUsersPayload) => {
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
  } catch (err) {
    logger.info(`searchFeaturedAndUsers: failed to run search: ${err.message}`)
    return
  }
  return BotsGen.createSetSearchFeaturedAndUsersResults({
    query,
    results: {
      bots: botRes?.bots ?? [],
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

function* botsSaga() {
  yield* Saga.chainAction2(BotsGen.getFeaturedBots, getFeaturedBots)
  yield* Saga.chainAction2(BotsGen.searchFeaturedBots, searchFeaturedBots)
  yield* Saga.chainAction(BotsGen.searchFeaturedAndUsers, searchFeaturedAndUsers)
  yield* Saga.chainAction(EngineGen.keybase1NotifyFeaturedBotsFeaturedBotsUpdate, onFeaturedBotsUpdate)
}

export default botsSaga
