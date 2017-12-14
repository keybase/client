// @flow
import * as ChatGen from '../chat-gen'
import * as Constants from '../../constants/chat'
import * as Types from '../../constants/types/chat'
import * as I from 'immutable'
import * as RPCChatTypes from '../../constants/types/flow-types-chat'
import * as RPCTypes from '../../constants/types/flow-types'
import {call, put, select} from 'redux-saga/effects'
import {usernameSelector} from '../../constants/selectors'
import flags from '../../util/feature-flags'

import type {TypedState} from '../../constants/reducer'

const metaDataSelector = (state: TypedState) => state.chat.get('metaData')
const routeSelector = (state: TypedState) =>
  state.routeTree.routeState ? state.routeTree.routeState.get('selected') : null
const focusedSelector = (state: TypedState) => state.config.appFocused
const conversationStateSelector = (state: TypedState, conversationIDKey: Types.ConversationIDKey) =>
  state.chat.getIn(['conversationStates', conversationIDKey])

// Actually start a new conversation. conversationIDKey can be a pending one or a replacement
function* startNewConversation(
  oldKey: Types.ConversationIDKey
): Generator<any, [?Types.ConversationIDKey, ?string], any> {
  const state: TypedState = yield select()
  // Find the participants
  const pendingTlfName = Constants.pendingConversationIDKeyToTlfName(oldKey)
  let tlfName
  if (pendingTlfName) {
    tlfName = pendingTlfName
  } else {
    const existing = Constants.getInbox(state, oldKey)
    if (existing) {
      tlfName = existing.get('participants').sort().join(',')
    }
  }

  if (!tlfName) {
    console.warn("Shouldn't happen in practice")
    return [null, null]
  }
  const membersType = flags.impTeamChatEnabled
    ? RPCChatTypes.commonConversationMembersType.impteam
    : RPCChatTypes.commonConversationMembersType.kbfs
  const result = yield call(RPCChatTypes.localNewConversationLocalRpcPromise, {
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
    tlfName,
    tlfVisibility: RPCTypes.commonTLFVisibility.private,
    topicType: RPCChatTypes.commonTopicType.chat,
    membersType,
  })

  const newKey = result ? Constants.conversationIDToKey(result.conv.info.id) : null
  if (!newKey) {
    console.warn('No convoid from newConvoRPC')
    return [null, null]
  }

  // Replace any existing convo
  if (pendingTlfName) {
    yield put(ChatGen.createPendingToRealConversation({oldKey, newKey}))
  } else if (oldKey !== newKey) {
    yield put(ChatGen.createDeleteEntity({keyPath: ['inbox'], ids: I.List([oldKey])}))
    yield put(ChatGen.createDeleteEntity({keyPath: ['inboxSmallTimestamps'], ids: I.List([oldKey])}))
  }

  // Select the new version if the old one was selected
  const selectedConversation = Constants.getSelectedConversation(state)
  if (selectedConversation === oldKey) {
    yield put(ChatGen.createSelectConversation({conversationIDKey: newKey}))
  }
  // Load the inbox so we can post, we wait till this is done
  yield put(ChatGen.createUnboxConversations({conversationIDKeys: [newKey], reason: 'new convo'}))
  return [newKey, tlfName]
}

// If we're showing a banner we send chatGui, if we're not we send chatGuiStrict
function* getPostingIdentifyBehavior(conversationIDKey: Types.ConversationIDKey): Generator<any, any, any> {
  const state: TypedState = yield select()
  const metaData = metaDataSelector(state)
  const inbox = Constants.getInbox(state, conversationIDKey)
  const you = usernameSelector(state)

  if (inbox && you) {
    const brokenUsers = Constants.getBrokenUsers(inbox.get('participants').toArray(), you, metaData)
    return brokenUsers.length
      ? RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui
      : RPCTypes.tlfKeysTLFIdentifyBehavior.chatGuiStrict
  }

  // This happens if you start a chat w/o having loaded the inbox state at all
  return RPCTypes.tlfKeysTLFIdentifyBehavior.chatGuiStrict
}

export {
  conversationStateSelector,
  focusedSelector,
  getPostingIdentifyBehavior,
  metaDataSelector,
  routeSelector,
  startNewConversation,
}
