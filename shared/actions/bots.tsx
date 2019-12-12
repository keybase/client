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

    console.warn('FEATURED BOTS', bots)

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

function* botsSaga() {
  yield* Saga.chainAction2(BotsGen.getFeaturedBots, getFeaturedBots)
}

export default botsSaga
