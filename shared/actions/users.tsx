// import * as UsersGen from './users-gen'
import * as Saga from '../util/saga'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as UsersGen from './users-gen'
import * as Chat2Gen from './chat2-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Chat2Constants from '../constants/chat2'
import {TypedState} from '../util/container'

const onIdentifyUpdate = (
  _: Container.TypedState,
  action: EngineGen.Keybase1NotifyUsersIdentifyUpdatePayload
) =>
  UsersGen.createUpdateBrokenState({
    newlyBroken: action.payload.params.brokenUsernames || [],
    newlyFixed: action.payload.params.okUsernames || [],
  })

const fetchUserBio = async (state: TypedState, action: Chat2Gen.SelectConversationPayload) => {
  const {conversationIDKey} = action.payload
  const meta = Chat2Constants.getMeta(state, conversationIDKey)
  const otherParticipants = Chat2Constants.getRowParticipants(meta, state.config.username || '')
  if (otherParticipants.count() === 1) {
    // we're in a one-on-one convo
    const username = otherParticipants.first('')
    if (username === '') {
      return // if for some reason we get a garbage username, don't do anything
    }
    if (state.users.infoMap.get(username, {bio: undefined}).bio) {
      return // don't re-fetch bio if we already have one cached
    }

    const userCard = await RPCTypes.userUserCardRpcPromise({useSession: true, username})
    if (!userCard) {
      return // don't do anything if we don't get a good response from rpc
    }

    return UsersGen.createUpdateBio({userCard, username}) // set bio in user infomap
  }
  return
}

function* usersSaga() {
  yield* Saga.chainAction2(EngineGen.keybase1NotifyUsersIdentifyUpdate, onIdentifyUpdate, 'onIdentifyUpdate')
  yield* Saga.chainAction2(Chat2Gen.selectConversation, fetchUserBio, 'fetchUpdateBio')
}

export default usersSaga
