// import * as UsersGen from './users-gen'
import * as Saga from '../util/saga'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as UsersGen from './users-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import {TypedState} from '../util/container'
import logger from '../logger'
import {RPCError} from 'util/errors'

const onIdentifyUpdate = (
  _: Container.TypedState,
  action: EngineGen.Keybase1NotifyUsersIdentifyUpdatePayload
) =>
  UsersGen.createUpdateBrokenState({
    newlyBroken: action.payload.params.brokenUsernames || [],
    newlyFixed: action.payload.params.okUsernames || [],
  })

// shouldn't know anything about chat stuff, only username => rpc call
const getBio = async (state: TypedState, action: UsersGen.GetBioPayload) => {
  const {username} = action.payload

  if (state.users.infoMap.get(username, {bio: undefined}).bio) {
    return // don't re-fetch bio if we already have one cached
  }

  try {
    const userCard = await RPCTypes.userUserCardRpcPromise({useSession: true, username})
    if (!userCard) {
      return // don't do anything if we don't get a good response from rpc
    }

    return UsersGen.createUpdateBio({userCard, username}) // set bio in user infomap
  } catch (e) {
    const err: RPCError = e
    if (Container.isNetworkErr(err.code)) {
      logger.info('Network error getting userCard')
    } else {
      logger.info(err.message)
    }
    return
  }
}

function* usersSaga() {
  yield* Saga.chainAction2(EngineGen.keybase1NotifyUsersIdentifyUpdate, onIdentifyUpdate, 'onIdentifyUpdate')
  yield* Saga.chainAction2(UsersGen.getBio, getBio)
}

export default usersSaga
