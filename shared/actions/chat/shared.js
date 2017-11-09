// @flow
import * as ChatGen from '../chat-gen'
import * as Constants from '../../constants/chat'
import * as I from 'immutable'
import * as RPCChatTypes from '../../constants/types/flow-types-chat'
import * as RPCTypes from '../../constants/types/flow-types'
import {call, put, select} from 'redux-saga/effects'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {usernameSelector} from '../../constants/selectors'
import flags from '../../util/feature-flags'

import type {TypedState} from '../../constants/reducer'

function followingSelector(state: TypedState) {
  return state.config.following
}
function alwaysShowSelector(state: TypedState) {
  return state.chat.get('inboxAlwaysShow')
}
function metaDataSelector(state: TypedState) {
  return state.chat.get('metaData')
}
function routeSelector(state: TypedState) {
  return state.routeTree.routeState ? state.routeTree.routeState.get('selected') : null
}
function focusedSelector(state: TypedState) {
  return state.config.appFocused
}
function activeSelector(state: TypedState) {
  return state.config.userActive
}
function conversationStateSelector(state: TypedState, conversationIDKey: Constants.ConversationIDKey) {
  return state.chat.getIn(['conversationStates', conversationIDKey])
}

function messageOutboxIDSelector(
  state: TypedState,
  conversationIDKey: Constants.ConversationIDKey,
  outboxID: Constants.OutboxIDKey
): ?Constants.Message {
  return Constants.getMessageFromConvKeyMessageID(state, conversationIDKey, outboxID)
}

function devicenameSelector(state: TypedState) {
  return state.config && state.config.deviceName
}

function inboxGlobalUntrustedStateSelector(state: TypedState) {
  return state.chat.get('inboxGlobalUntrustedState')
}

function tmpFileName(
  isPreview: boolean,
  conversationID: Constants.ConversationIDKey,
  messageID: Constants.MessageID
) {
  if (!messageID) {
    throw new Error('tmpFileName called without messageID!')
  }

  return `kbchat-${conversationID}-${messageID}.${isPreview ? 'preview' : 'download'}`
}

// Actually start a new conversation. conversationIDKey can be a pending one or a replacement
function* startNewConversation(
  oldKey: Constants.ConversationIDKey
): Generator<any, [?Constants.ConversationIDKey, ?string], any> {
  // Find the participants
  const pendingTlfName = Constants.pendingConversationIDKeyToTlfName(oldKey)
  let tlfName
  if (pendingTlfName) {
    tlfName = pendingTlfName
  } else {
    const existing = yield select(Constants.getInbox, oldKey)
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
    param: {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      tlfName,
      tlfVisibility: RPCTypes.commonTLFVisibility.private,
      topicType: RPCChatTypes.commonTopicType.chat,
      membersType,
    },
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
  const selectedConversation = yield select(Constants.getSelectedConversation)
  if (selectedConversation === oldKey) {
    yield put(ChatGen.createSelectConversation({conversationIDKey: newKey}))
  }
  // Load the inbox so we can post, we wait till this is done
  yield put(ChatGen.createUnboxConversations({conversationIDKeys: [newKey], reason: 'new convo'}))
  return [newKey, tlfName]
}

// If we're showing a banner we send chatGui, if we're not we send chatGuiStrict
function* getPostingIdentifyBehavior(
  conversationIDKey: Constants.ConversationIDKey
): Generator<any, any, any> {
  const metaData = (yield select(metaDataSelector): any)
  const inbox = yield select(Constants.getInbox, conversationIDKey)
  const you = yield select(usernameSelector)

  if (inbox && you) {
    const brokenUsers = Constants.getBrokenUsers(inbox.get('participants').toArray(), you, metaData)
    return brokenUsers.length
      ? RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui
      : RPCTypes.tlfKeysTLFIdentifyBehavior.chatGuiStrict
  }

  // This happens if you start a chat w/o having loaded the inbox state at all
  return RPCTypes.tlfKeysTLFIdentifyBehavior.chatGuiStrict
}

function makeInboxStateRecords(
  author: string,
  items: Array<RPCChatTypes.UnverifiedInboxUIItem>,
  oldInbox: I.Map<Constants.ConversationIDKey, Constants.InboxState>
): Array<Constants.InboxState> {
  return (items || [])
    .map(c => {
      // We already know about this version? Skip it
      if (oldInbox.getIn([c.convID, 'version']) === c.version) {
        return null
      }
      const parts = c.localMetadata
        ? I.List(c.localMetadata.writerNames || [])
        : I.List(parseFolderNameToUsers(author, c.name).map(ul => ul.username))
      return Constants.makeInboxState({
        channelname: c.membersType === RPCChatTypes.commonConversationMembersType.team && c.localMetadata
          ? c.localMetadata.channelName
          : undefined,
        conversationIDKey: c.convID,
        fullNames: I.Map(),
        info: null,
        maxMsgID: c.maxMsgID,
        memberStatus: c.memberStatus,
        membersType: c.membersType,
        participants: parts,
        status: Constants.ConversationStatusByEnum[c.status || 0],
        teamType: c.teamType,
        teamname: c.membersType === RPCChatTypes.commonConversationMembersType.team ? c.name : undefined,
        time: c.time,
        version: c.version,
      })
    })
    .filter(Boolean)
}

export {
  alwaysShowSelector,
  conversationStateSelector,
  devicenameSelector,
  focusedSelector,
  activeSelector,
  followingSelector,
  getPostingIdentifyBehavior,
  inboxGlobalUntrustedStateSelector,
  makeInboxStateRecords,
  messageOutboxIDSelector,
  metaDataSelector,
  routeSelector,
  startNewConversation,
  tmpFileName,
}
