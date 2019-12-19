import * as BotsGen from './bots-gen'
import * as Saga from '../util/saga'
import * as Container from '../util/container'
import * as RPCTypes from '../constants/types/rpc-gen'
import logger from '../logger'
import {RPCError} from 'util/errors'

const pageSize = 100

const getFeaturedBots = async (_: Container.TypedState, action: BotsGen.GetFeaturedBotsPayload) => {
  const {limit, page} = action.payload

  try {
    const {bots} = await RPCTypes.featuredBotFeaturedBotsRpcPromise({
      limit: limit ?? pageSize,
      offset: (page ?? 0) * (limit ?? pageSize),
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

function* botsSaga() {
  yield* Saga.chainAction2(BotsGen.getFeaturedBots, getFeaturedBots)
  yield* Saga.chainAction2(BotsGen.searchFeaturedBots, searchFeaturedBots)
}

export default botsSaga
