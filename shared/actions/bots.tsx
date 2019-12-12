import * as BotsGen from './bots-gen'
import * as Saga from '../util/saga'
import * as Container from '../util/container'
import * as RPCTypes from '../constants/types/rpc-gen'
import logger from '../logger'
import {RPCError} from 'util/errors'

const getFeaturedBots = async (_: Container.TypedState, action: BotsGen.GetFeaturedBotsPayload) => {
  const {limit, offset} = action.payload

  try {
    const {bots} = await RPCTypes.featuredBotFeaturedBotsRpcPromise({limit: limit ?? 10, offset: offset ?? 0})
    if (!bots || bots.length == 0) {
      // don't do anything with a bad response from rpc
      return
    }

    return BotsGen.createUpdateFeaturedBots({bots})
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

const searchFeaturedBots = async (state: Container.TypedState, action: BotsGen.SearchFeaturedBotsPayload) => {
  const {limit, offset, query} = action.payload

  if (state.chat2.featuredBotsMap.has(query)) {
    // don't refresh featured bot if it's in the store
    // TODO: smartly check?
    return
  }
  try {
    const {bots} = await RPCTypes.featuredBotSearchRpcPromise({limit: limit ?? 1, offset: offset ?? 0, query})
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
