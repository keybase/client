// @flow
import * as Constants from '../../constants/chat'
import HiddenString from '../../util/hidden-string'
import engine from '../../engine'
import {some} from 'lodash'
import {List, Map} from 'immutable'
import {NotifyPopup} from '../../native/notifications'
import {apiserverGetRpcPromise, TlfKeysTLFIdentifyBehavior} from '../../constants/types/flow-types'
import {badgeApp} from '../notifications'
import {call, put, take, select, race, cancel, fork, join} from 'redux-saga/effects'
import {changedFocus} from '../../constants/window'
import {delay} from 'redux-saga'
import {navigateAppend, navigateTo, switchTo} from '../route-tree'
import {openInKBFS} from '../kbfs'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {publicFolderWithUsers, privateFolderWithUsers} from '../../constants/config'
import {reset as searchReset, addUsersToGroup as searchAddUsersToGroup} from '../search'
import {safeTakeEvery, safeTakeLatest, safeTakeSerially, singleFixedChannelConfig, cancelWhen, closeChannelMap, takeFromChannelMap, effectOnChannelMap} from '../../util/saga'
import {searchTab, chatTab} from '../../constants/tabs'
import {tmpFile, downloadFilePath, copy, exists} from '../../util/file'
import {usernameSelector} from '../../constants/selectors'
import {isMobile} from '../../constants/platform'
import {toDeviceType, unsafeUnwrap} from '../../constants/types/more'
import {showMainWindow, saveAttachment, showShareActionSheet} from '../platform.specific'
import {requestIdleCallback} from '../../util/idle-callback'
import {
  addPending,
  badgeAppForChat,
  blockConversation,
  deleteMessage,
  editMessage,
  loadAttachment,
  loadInbox,
  loadMoreMessages,
  loadedInbox,
  muteConversation,
  newChat,
  openFolder,
  openTlfInChat,
  pendingToRealConversation,
  postMessage,
  replaceConversation,
  retryAttachment,
  retryMessage,
  selectAttachment,
  selectConversation,
  setupChatHandlers,
  showEditor,
  startConversation,
  updateBadging,
  updateLatestMessage,
  updateTempMessage,
} from './creators'

import * as ChatTypes from '../../constants/types/flow-types-chat'

import type {Action} from '../../constants/types/flux'
import type {ChangedFocus} from '../../constants/window'
import type {TLFIdentifyBehavior} from '../../constants/types/flow-types'
import type {FailedMessageInfo, IncomingMessage as IncomingMessageRPCType, MessageBody, MessageText, MessageUnboxed, OutboxRecord, SetStatusInfo, ConversationLocal, GetInboxLocalRes} from '../../constants/types/flow-types-chat'
import type {SagaGenerator, ChannelMap} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'
import type {
  AppendMessages,
  BadgeAppForChat,
  BlockConversation,
  ConversationIDKey,
  CreatePendingFailure,
  DeleteMessage,
  EditMessage,
  FinalizedState,
  InboxState,
  IncomingMessage,
  LoadInbox,
  LoadMoreMessages,
  MarkThreadsStale,
  MaybeTimestamp,
  Message,
  MessageID,
  MessageState,
  MetaData,
  MuteConversation,
  NewChat,
  OpenAttachmentPopup,
  OpenTlfInChat,
  OutboxIDKey,
  PostMessage,
  RemoveOutboxMessage,
  RemovePendingFailure,
  RetryMessage,
  SelectConversation,
  StartConversation,
  UnhandledMessage,
  UpdateBadging,
  UpdateMetadata,
} from '../../constants/chat'

const {
  CommonConversationStatus,
  CommonMessageType,
  CommonTLFVisibility,
  CommonTopicType,
  LocalAssetMetadataType,
  LocalMessageUnboxedErrorType,
  LocalConversationErrorType,
  LocalMessageUnboxedState,
  NotifyChatChatActivityType,
  localCancelPostRpcPromise,
  localDownloadFileAttachmentLocalRpcChannelMap,
  localGetInboxNonblockLocalRpcChannelMap,
  localGetThreadLocalRpcPromise,
  localMarkAsReadLocalRpcPromise,
  localNewConversationLocalRpcPromise,
  localPostDeleteNonblockRpcPromise,
  localPostEditNonblockRpcPromise,
  localPostFileAttachmentLocalRpcChannelMap,
  localPostLocalNonblockRpcPromise,
  localRetryPostRpcPromise,
  localSetConversationStatusLocalRpcPromise,
} = ChatTypes

const {
  InboxStateRecord,
  MetaDataRecord,
  conversationIDToKey,
  getBrokenUsers,
  isPendingConversationIDKey,
  keyToConversationID,
  keyToOutboxID,
  makeSnippet,
  outboxIDToKey,
  pendingConversationIDKey,
  pendingConversationIDKeyToTlfName,
  serverMessageToMessageBody,
  getSelectedConversation,
} = Constants

const safeServerMessageMap = m => ({
  key: m.key,
  messageID: m.messageID,
  messageState: m.messageState,
  outboxID: m.outboxID,
  type: m.type,
})

const prependMessagesActionTransformer = action => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
    hasPaginationNext: !!action.payload.paginationNext,
    messages: action.payload.messages.map(safeServerMessageMap),
    moreToLoad: action.payload.moreToLoad,
  },
  type: action.type,
})

const appendMessageActionTransformer = action => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
    messages: action.payload.messages.map(safeServerMessageMap),
  },
  type: action.type,
})

const _selectedInboxSelector = (state: TypedState, conversationIDKey) => {
  return state.chat.get('inbox').find(convo => convo.get('conversationIDKey') === conversationIDKey)
}

const _alwaysShowSelector = (state: TypedState) => state.chat.get('alwaysShow')
const _metaDataSelector = (state: TypedState) => state.chat.get('metaData')
const _routeSelector = (state: TypedState) => state.routeTree.get('routeState').get('selected')
const _focusedSelector = (state: TypedState) => state.chat.get('focused')
const _conversationStateSelector = (state: TypedState, conversationIDKey: ConversationIDKey) => state.chat.get('conversationStates', Map()).get(conversationIDKey)
const _messageSelector = (state: TypedState, conversationIDKey: ConversationIDKey, messageID: MessageID) => _conversationStateSelector(state, conversationIDKey).get('messages').find(m => m.messageID === messageID)
const _messageOutboxIDSelector = (state: TypedState, conversationIDKey: ConversationIDKey, outboxID: OutboxIDKey) => _conversationStateSelector(state, conversationIDKey).get('messages').find(m => m.outboxID === outboxID)
const _pendingFailureSelector = (state: TypedState, outboxID: OutboxIDKey) => state.chat.get('pendingFailures').get(outboxID)
const _devicenameSelector = (state: TypedState) => state.config && state.config.extendedConfig && state.config.extendedConfig.device && state.config.extendedConfig.device.name

function _tmpFileName (isHdPreview: boolean, conversationID: ConversationIDKey, messageID: ?MessageID, filename: string) {
  return `kbchat-${isHdPreview ? 'hdPreview' : 'preview'}-${conversationID}-${messageID || ''}-${filename}`
}

function _inboxConversationToInboxState (convo: ?ConversationLocal): ?InboxState {
  if (!convo || !convo.info || !convo.info.id) {
    return null
  }

  if (convo.info.visibility !== ChatTypes.CommonTLFVisibility.private) {
    return null
  }

  // We don't support mixed reader/writers
  if (convo.info.tlfName.includes('#')) {
    return null
  }

  const conversationIDKey = conversationIDToKey(convo.info.id)
  let snippet
  let time

  (convo.maxMessages || []).some(message => {
    if (message.state === LocalMessageUnboxedState.valid && message.valid && convo && convo.readerInfo) {
      time = message.valid.serverHeader.ctime || convo.readerInfo.mtime
      snippet = makeSnippet(message.valid.messageBody)
      return !!snippet
    }
    return false
  })

  const participants = List(convo.info.writerNames || [])
  const infoStatus = convo.info ? convo.info.status : 0
  // Go backwards from the value in CommonConversationStatus to its key.
  const status = Constants.ConversationStatusByEnum[infoStatus]

  return new InboxStateRecord({
    info: convo.info,
    isEmpty: convo.isEmpty,
    conversationIDKey,
    participants,
    status,
    time,
    snippet,
    validated: true,
  })
}

function _toSupersedeInfo (conversationIDKey: ConversationIDKey, supersedeData: Array<ChatTypes.ConversationMetadata>): ?Constants.SupersedeInfo {
  const parsed = supersedeData
    .filter(md => md.idTriple.topicType === CommonTopicType.chat && md.finalizeInfo)
    .map(md => ({
      conversationIDKey: conversationIDToKey(md.conversationID),
      finalizeInfo: unsafeUnwrap(md && md.finalizeInfo),
    }))
  return parsed.length ? parsed[0] : null
}

function _inboxConversationLocalToSupersedesState (convo: ?ChatTypes.ConversationLocal): Constants.SupersedesState {
  // TODO deep supersedes checking
  if (!convo || !convo.info || !convo.info.id || !convo.supersedes) {
    return Map()
  }

  const conversationIDKey = conversationIDToKey(convo.info.id)
  const supersedes = _toSupersedeInfo(conversationIDKey, (convo.supersedes || []))
  return supersedes ? Map({[conversationIDKey]: supersedes}) : Map()
}

function _inboxConversationLocalToSupersededByState (convo: ?ChatTypes.ConversationLocal): Constants.SupersededByState {
  if (!convo || !convo.info || !convo.info.id || !convo.supersededBy) {
    return Map()
  }

  const conversationIDKey = conversationIDToKey(convo.info.id)
  const supersededBy = _toSupersedeInfo(conversationIDKey, (convo.supersededBy || []))
  return supersededBy ? Map({[conversationIDKey]: supersededBy}) : Map()
}

function _inboxToFinalized (inbox: GetInboxLocalRes): FinalizedState {
  return Map((inbox.conversationsUnverified || []).map(convoUnverified => [
    conversationIDToKey(convoUnverified.metadata.conversationID),
    convoUnverified.metadata.finalizeInfo,
  ]))
}

function _conversationLocalToFinalized (convo: ?ChatTypes.ConversationLocal): FinalizedState {
  if (convo && convo.info.id && convo.info.finalizeInfo) {
    return Map({
      [conversationIDToKey(convo.info.id)]: convo.info.finalizeInfo,
    })
  }
  return Map()
}

function _inboxToConversations (inbox: GetInboxLocalRes, author: ?string, following: {[key: string]: boolean}, metaData: MetaData): List<InboxState> {
  return List((inbox.conversationsUnverified || []).map(convoUnverified => {
    const msgMax = convoUnverified.maxMsgSummaries && convoUnverified.maxMsgSummaries.length && convoUnverified.maxMsgSummaries[0]

    if (!msgMax) {
      return null
    }

    const participants = List(parseFolderNameToUsers(author, msgMax.tlfName).map(ul => ul.username))
    const statusEnum = convoUnverified.metadata.status || 0
    const status = Constants.ConversationStatusByEnum[statusEnum]

    return new InboxStateRecord({
      info: null,
      conversationIDKey: conversationIDToKey(convoUnverified.metadata.conversationID),
      participants,
      status,
      time: convoUnverified.readerInfo && convoUnverified.readerInfo.mtime,
      snippet: ' ',
      validated: false,
    })
  }).filter(Boolean))
}

function * _clientHeader (messageType: ChatTypes.MessageType, conversationIDKey): Generator<any, ?ChatTypes.MessageClientHeader, any> {
  const infoSelector = (state: TypedState) => {
    const convo = state.chat.get('inbox').find(convo => convo.get('conversationIDKey') === conversationIDKey)
    if (convo) {
      return convo.get('info')
    }
    return null
  }

  const info = yield select(infoSelector)

  if (!info) {
    console.warn('No info to postmessage!')
    return
  }

  const configSelector = (state: TypedState) => {
    try {
      return {
        // $FlowIssue doesn't understand try
        deviceID: state.config.extendedConfig.device.deviceID,
        uid: state.config.uid,
      }
    } catch (_) {
      return {
        deviceID: '',
        uid: '',
      }
    }
  }

  const {deviceID, uid}: {deviceID: string, uid: string} = ((yield select(configSelector)): any)

  if (!deviceID || !uid) {
    console.warn('No deviceid/uid to postmessage!')
    return
  }

  return {
    conv: info.triple,
    tlfName: info.tlfName,
    tlfPublic: info.visibility === CommonTLFVisibility.public,
    messageType,
    supersedes: 0,
    sender: Buffer.from(uid, 'hex'),
    senderDevice: Buffer.from(deviceID, 'hex'),
  }
}

function * _retryMessage (action: RetryMessage): SagaGenerator<any, any> {
  const {conversationIDKey, outboxIDKey} = action.payload

  yield put(updateTempMessage(conversationIDKey, {messageState: 'pending'}, outboxIDKey))

  yield call(localRetryPostRpcPromise, {
    param: {
      outboxID: keyToOutboxID(outboxIDKey),
    },
  })
}

// If we're showing a banner we send chatGui, if we're not we send chatGuiStrict
function * _getPostingIdentifyBehavior (conversationIDKey: ConversationIDKey) {
  const metaData = ((yield select(_metaDataSelector)): any)
  const inbox = yield select(_selectedInboxSelector, conversationIDKey)
  const you = yield select(usernameSelector)

  if (inbox && you) {
    const brokenUsers = getBrokenUsers(inbox.get('participants').toArray(), you, metaData)
    return brokenUsers.length ? TlfKeysTLFIdentifyBehavior.chatGui : TlfKeysTLFIdentifyBehavior.chatGuiStrict
  }

  // Shouldn't happen but fallback to strict mode
  if (__DEV__) {
    console.warn('Missing inbox or you when posting')
  }
  return TlfKeysTLFIdentifyBehavior.chatGuiStrict
}

function * _editMessage (action: EditMessage): SagaGenerator<any, any> {
  const {message} = action.payload
  let messageID: ?MessageID
  let conversationIDKey: ConversationIDKey = ''
  switch (message.type) {
    case 'Text':
    case 'Attachment': // fallthrough
      conversationIDKey = message.conversationIDKey
      messageID = message.messageID
      break
  }

  if (!messageID) {
    console.warn('Editing unknown message type', message)
    return
  }

  const clientHeader = yield call(_clientHeader, CommonMessageType.edit, conversationIDKey)
  const conversationState = yield select(_conversationStateSelector, conversationIDKey)
  let lastMessageID
  if (conversationState) {
    const message = conversationState.messages.findLast(m => !!m.messageID)
    if (message) {
      lastMessageID = message.messageID
    }
  }

  yield call(localPostEditNonblockRpcPromise, {
    param: {
      body: action.payload.text.stringValue(),
      clientPrev: lastMessageID,
      conv: clientHeader.conv,
      conversationID: keyToConversationID(conversationIDKey),
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      supersedes: messageID,
      tlfName: clientHeader.tlfName,
      tlfPublic: clientHeader.tlfPublic,
    },
  })
}

// Actually start a new conversation. conversationIDKey can be a pending one or a replacement
function * _startNewConversation (oldConversationIDKey: ConversationIDKey) {
  // Find the participants
  const pendingTlfName = pendingConversationIDKeyToTlfName(oldConversationIDKey)
  let tlfName
  if (pendingTlfName) {
    tlfName = pendingTlfName
  } else {
    const existing = yield select(_selectedInboxSelector, oldConversationIDKey)
    if (existing) {
      tlfName = existing.get('participants').join(',')
    }
  }

  if (!tlfName) {
    console.warn("Shouldn't happen in practice")
    return null
  }

  const result = yield call(localNewConversationLocalRpcPromise, {
    param: {
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
      tlfName,
      tlfVisibility: CommonTLFVisibility.private,
      topicType: CommonTopicType.chat,
    }})

  const newConversationIDKey = result ? conversationIDToKey(result.conv.info.id) : null
  if (!newConversationIDKey) {
    console.warn('No convoid from newConvoRPC')
    return null
  }

  // Replace any existing convo
  if (pendingTlfName) {
    yield put(pendingToRealConversation(oldConversationIDKey, newConversationIDKey))
  } else {
    yield put(replaceConversation(oldConversationIDKey, newConversationIDKey))
  }

  // Select the new version if the old one was selected
  const selectedConversation = yield select(getSelectedConversation)
  if (selectedConversation === oldConversationIDKey) {
    yield put(selectConversation(newConversationIDKey, false))
  }
  // Load the inbox so we can post, we wait till this is done
  yield call(_getInboxAndUnbox, {payload: {conversationIDKey: newConversationIDKey}, type: 'chat:getInboxAndUnbox'})
  return newConversationIDKey
}

function * _postMessage (action: PostMessage): SagaGenerator<any, any> {
  let {conversationIDKey} = action.payload

  if (isPendingConversationIDKey(conversationIDKey)) {
    // Get a real conversationIDKey
    conversationIDKey = yield call(_startNewConversation, conversationIDKey)
    if (!conversationIDKey) {
      return
    }
  }

  const clientHeader = yield call(_clientHeader, CommonMessageType.text, conversationIDKey)
  const conversationState = yield select(_conversationStateSelector, conversationIDKey)
  let lastMessageID
  if (conversationState) {
    const message = conversationState.messages.findLast(m => !!m.messageID)
    if (message) {
      lastMessageID = message.messageID
    }
  }

  const sent = yield call(localPostLocalNonblockRpcPromise, {
    param: {
      conversationID: keyToConversationID(conversationIDKey),
      identifyBehavior: yield call(_getPostingIdentifyBehavior, conversationIDKey),
      clientPrev: lastMessageID,
      msg: {
        clientHeader,
        messageBody: {
          messageType: CommonMessageType.text,
          text: {
            body: action.payload.text.stringValue(),
          },
        },
      },
    },
  })

  const author = yield select(usernameSelector)
  if (sent && author) {
    const outboxID = outboxIDToKey(sent.outboxID)
    const hasPendingFailure = yield select(_pendingFailureSelector, outboxID)
    const message: Message = {
      author,
      conversationIDKey: action.payload.conversationIDKey,
      deviceName: '',
      deviceType: isMobile ? 'mobile' : 'desktop',
      editedCount: 0,
      failureDescription: null,
      key: Constants.messageKey('outboxID', outboxID),
      message: new HiddenString(action.payload.text.stringValue()),
      messageState: hasPendingFailure ? 'failed' : 'pending',
      outboxID,
      senderDeviceRevokedAt: null,
      timestamp: Date.now(),
      type: 'Text',
      you: author,
    }

    // Time to decide: should we add a timestamp before our new message?
    const conversationState = yield select(_conversationStateSelector, conversationIDKey)
    let messages = []
    if (conversationState && conversationState.messages !== null && conversationState.messages.size > 0) {
      const prevMessage = conversationState.messages.get(conversationState.messages.size - 1)
      const timestamp = _maybeAddTimestamp(message, prevMessage)
      if (timestamp !== null) {
        messages.push(timestamp)
      }
    }

    messages.push(message)
    const selectedConversation = yield select(getSelectedConversation)
    yield put({
      logTransformer: appendMessageActionTransformer,
      payload: {
        conversationIDKey,
        isSelected: conversationIDKey === selectedConversation,
        messages,
      },
      type: 'chat:appendMessages',
    })
    if (hasPendingFailure) {
      yield put(({
        payload: {
          outboxID,
        },
        type: 'chat:removePendingFailure',
      }: RemovePendingFailure))
    }
  }
}

function * _deleteMessage (action: DeleteMessage): SagaGenerator<any, any> {
  const {message} = action.payload
  let messageID: ?MessageID
  let conversationIDKey: ConversationIDKey
  switch (message.type) {
    case 'Text':
      conversationIDKey = message.conversationIDKey
      messageID = message.messageID
      break
    case 'Attachment':
      conversationIDKey = message.conversationIDKey
      messageID = message.messageID
      break
  }

  if (!conversationIDKey) throw new Error('No conversation for message delete')

  if (messageID) {
    // Deleting a server message.
    const clientHeader = yield call(_clientHeader, CommonMessageType.delete, conversationIDKey)
    const conversationState = yield select(_conversationStateSelector, conversationIDKey)
    let lastMessageID
    if (conversationState) {
      const message = conversationState.messages.findLast(m => !!m.messageID)
      if (message) {
        lastMessageID = message.messageID
      }
    }

    yield call(localPostDeleteNonblockRpcPromise, {
      param: {
        clientPrev: lastMessageID,
        conv: clientHeader.conv,
        conversationID: keyToConversationID(conversationIDKey),
        identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
        supersedes: messageID,
        tlfName: clientHeader.tlfName,
        tlfPublic: clientHeader.tlfPublic,
      },
    })
  } else {
    // Deleting a local outbox message.
    if (message.messageState !== 'failed') throw new Error('Tried to delete a non-failed message')
    const outboxID = message.outboxID
    if (!outboxID) throw new Error('No outboxID for pending message delete')

    yield call(localCancelPostRpcPromise, {
      param: {
        outboxID: keyToOutboxID(outboxID),
      },
    })
    // It's deleted, but we don't get notified that the conversation now has
    // one less outbox entry in it.  Gotta remove it from the store ourselves.
    yield put(({
      payload: {conversationIDKey, outboxID},
      type: 'chat:removeOutboxMessage',
    }: RemoveOutboxMessage))
  }
}

function * _updateInbox (conv: ?ConversationLocal) {
  const inboxState = _inboxConversationToInboxState(conv)
  const supersedesState: Constants.SupersedesState = _inboxConversationLocalToSupersedesState(conv)
  const supersededByState: Constants.SupersededByState = _inboxConversationLocalToSupersededByState(conv)
  const finalizedState: Constants.FinalizedState = _conversationLocalToFinalized(conv)

  if (supersedesState.count()) {
    yield put(({type: 'chat:updateSupersedesState', payload: {supersedesState}}: Constants.UpdateSupersedesState))
  }
  if (supersededByState.count()) {
    yield put(({type: 'chat:updateSupersededByState', payload: {supersededByState}}: Constants.UpdateSupersededByState))
  }
  if (finalizedState.count()) {
    yield put(({type: 'chat:updateFinalizedState', payload: {finalizedState}}: Constants.UpdateFinalizedState))
  }

  if (inboxState) {
    yield put(({
      payload: {conversation: inboxState},
      type: 'chat:updateInbox',
    }: Constants.UpdateInbox))
  }
}

function * _incomingMessage (action: IncomingMessage): SagaGenerator<any, any> {
  switch (action.payload.activity.activityType) {
    case NotifyChatChatActivityType.setStatus:
      const setStatus: ?SetStatusInfo = action.payload.activity.setStatus
      if (setStatus) {
        yield call(_updateInbox, setStatus.conv)
        yield call(_ensureValidSelectedChat, false, true)
      }
      return
    case NotifyChatChatActivityType.failedMessage:
      const failedMessage: ?FailedMessageInfo = action.payload.activity.failedMessage
      if (failedMessage && failedMessage.outboxRecords) {
        for (const outboxRecord of failedMessage.outboxRecords) {
          const conversationIDKey = conversationIDToKey(outboxRecord.convID)
          const outboxID = outboxIDToKey(outboxRecord.outboxID)
          // $FlowIssue
          const failureDescription = _decodeFailureDescription(outboxRecord.state.error.typ)
          // There's an RPC race condition here.  Two possibilities:
          //
          // Either we've already finished in _postMessage() and have recorded
          // the outboxID pending message in the store, or we haven't.  If we
          // have, just set it to failed.  If we haven't, record this as a
          // pending failure, and pick up the pending failure at the bottom of
          // _postMessage() instead.
          //
          // Do we have this conversation loaded?  If not, don't do anything -
          // we'll pick up the failure when we load that thread.
          const isConversationLoaded = yield select(_conversationStateSelector, conversationIDKey)
          if (!isConversationLoaded) return

          const pendingMessage = yield select(_messageOutboxIDSelector, conversationIDKey, outboxID)
          if (pendingMessage) {
            yield put(updateTempMessage(
              conversationIDKey,
              {
                ...pendingMessage,
                failureDescription,
                messageState: 'failed',
              },
              outboxID
            ))
          } else {
            yield put(({
              payload: {
                failureDescription,
                outboxID,
              },
              type: 'chat:createPendingFailure',
            }: CreatePendingFailure))
          }
        }
      }
      return
    case NotifyChatChatActivityType.readMessage:
      if (action.payload.activity.readMessage) {
        yield call(_updateInbox, action.payload.activity.readMessage.conv)
      }
      return
    case NotifyChatChatActivityType.incomingMessage:
      const incomingMessage: ?IncomingMessageRPCType = action.payload.activity.incomingMessage
      if (incomingMessage) {
        // If it's a public chat, the GUI (currently) wants no part of it. We
        // especially don't want to surface the conversation as if it were a
        // private one, which is what we were doing before this change.
        if (incomingMessage.conv && incomingMessage.conv.info && incomingMessage.conv.info.visibility !== CommonTLFVisibility.private) {
          return
        }

        yield call(_updateInbox, incomingMessage.conv)

        const messageUnboxed: MessageUnboxed = incomingMessage.message
        const yourName = yield select(usernameSelector)
        const yourDeviceName = yield select(_devicenameSelector)
        const conversationIDKey = conversationIDToKey(incomingMessage.convID)
        const message = _unboxedToMessage(messageUnboxed, yourName, yourDeviceName, conversationIDKey)

        const pagination = incomingMessage.pagination
        if (pagination) {
          yield put(({
            type: 'chat:updatePaginationNext',
            payload: {
              conversationIDKey,
              paginationNext: pagination.next,
            },
          }: Constants.UpdatePaginationNext))
        }

        // Is this message for the currently selected and focused conversation?
        // And is the Chat tab the currently displayed route? If all that is
        // true, mark it as read ASAP to avoid badging it -- we don't need to
        // badge, the user's looking at it already.  Also mark as read ASAP if
        // it was written by the current user.
        const selectedConversationIDKey = yield select(getSelectedConversation)
        const appFocused = yield select(_focusedSelector)
        const selectedTab = yield select(_routeSelector)
        const chatTabSelected = (selectedTab === chatTab)
        const conversationIsFocused = conversationIDKey === selectedConversationIDKey && appFocused && chatTabSelected

        if (message && message.messageID && conversationIsFocused) {
          yield call(localMarkAsReadLocalRpcPromise, {
            param: {
              conversationID: incomingMessage.convID,
              msgID: message.messageID,
            },
          })
        }

        const conversationState = yield select(_conversationStateSelector, conversationIDKey)
        if (message.type === 'Text' && message.outboxID && message.deviceName === yourDeviceName && yourName === message.author) {
          // If the message has an outboxID and came from our device, then we
          // sent it and have already rendered it in the message list; we just
          // need to mark it as sent.
          yield put(updateTempMessage(
            conversationIDKey,
            {
              ...message,
              messageState: 'sent',
            },
            message.outboxID
          ))

          const messageID = message.messageID
          if (messageID) {
            yield put(({
              type: 'chat:markSeenMessage',
              payload: {
                conversationIDKey,
                messageID,
              },
            }: Constants.MarkSeenMessage))
          }
        } else {
          // How long was it between the previous message and this one?
          if (conversationState && conversationState.messages !== null && conversationState.messages.size > 0) {
            const prevMessage = conversationState.messages.get(conversationState.messages.size - 1)

            const timestamp = _maybeAddTimestamp(message, prevMessage)
            if (timestamp !== null) {
              yield put({
                logTransformer: appendMessageActionTransformer,
                payload: {
                  conversationIDKey,
                  isSelected: conversationIDKey === selectedConversationIDKey,
                  messages: [timestamp],
                },
                type: 'chat:appendMessages',
              })
            }
          }

          let existingMessage
          if (message.messageID) {
            existingMessage = yield select(_messageSelector, conversationIDKey, message.messageID)
          }

          // If we already have an existing message (say for an attachment, let's reuse that)
          if (existingMessage && existingMessage.outboxID && message.type === 'Attachment') {
            yield put(({
              type: 'chat:updateTempMessage',
              payload: {
                conversationIDKey,
                outboxID: existingMessage.outboxID,
                message,
              },
            }: Constants.UpdateTempMessage))
          } else {
            yield put({
              logTransformer: appendMessageActionTransformer,
              payload: {
                conversationIDKey,
                isSelected: conversationIDKey === selectedConversationIDKey,
                messages: [message],
              },
              type: 'chat:appendMessages',
            })
          }

          if ((message.type === 'Attachment' || message.type === 'UpdateAttachment') && !message.previewPath && message.messageID) {
            const messageID = message.type === 'UpdateAttachment' ? message.targetMessageID : message.messageID
            const filename = message.type === 'UpdateAttachment' ? message.updates.filename : message.filename
            if (filename) {
              yield put(loadAttachment(conversationIDKey, messageID, true, false, tmpFile(_tmpFileName(false, conversationIDKey, messageID, filename))))
            }
          }
        }
      }
      break
    default:
      console.warn('Unsupported incoming message type for Chat of type:', action.payload.activity.activityType)
  }
}

function * _setupChatHandlers (): SagaGenerator<any, any> {
  yield put((dispatch: Dispatch) => {
    engine().setIncomingHandler('chat.1.NotifyChat.NewChatActivity', ({activity}) => {
      dispatch({type: 'chat:incomingMessage', payload: {activity}})
    })

    engine().setIncomingHandler('chat.1.NotifyChat.ChatIdentifyUpdate', ({update}) => {
      const usernames = update.CanonicalName.split(',')
      const broken = (update.breaks.breaks || []).map(b => b.user.username)
      const userToBroken = usernames.reduce((map, name) => {
        map[name] = !!broken.includes(name)
        return map
      }, {})
      dispatch({type: 'chat:updateBrokenTracker', payload: {userToBroken}})
    })

    engine().setIncomingHandler('chat.1.NotifyChat.ChatTLFFinalize', ({convID}) => {
      dispatch(({type: 'chat:getInboxAndUnbox', payload: {conversationIDKey: conversationIDToKey(convID)}}: Constants.GetInboxAndUnbox))
    })

    engine().setIncomingHandler('chat.1.NotifyChat.ChatInboxStale', () => {
      dispatch({type: 'chat:inboxStale', payload: undefined})
    })

    engine().setIncomingHandler('chat.1.NotifyChat.ChatTLFResolve', ({convID, resolveInfo: {newTLFName}}) => {
      dispatch({type: 'chat:inboxStale', payload: undefined})
    })

    engine().setIncomingHandler('chat.1.NotifyChat.ChatThreadsStale', ({convIDs}) => {
      dispatch({type: 'chat:markThreadsStale', payload: {convIDs: convIDs.map(conversationIDToKey)}})
    })
  })
}

const inboxSelector = (state: TypedState, conversationIDKey) => state.chat.get('inbox')

function * _ensureValidSelectedChat (onlyIfNoSelection: boolean, forceSelectOnMobile: boolean) {
  // Mobile doesn't auto select a conversation
  if (isMobile && !forceSelectOnMobile) {
    return
  }

  const inbox = yield select(inboxSelector)
  if (inbox.count()) {
    const conversationIDKey = yield select(getSelectedConversation)

    if (onlyIfNoSelection && conversationIDKey) {
      return
    }

    const alwaysShow = yield select(_alwaysShowSelector)

    const current = inbox.find(c => c.get('conversationIDKey') === conversationIDKey)
    // current is good
    if (current && (!current.get('isEmpty') || alwaysShow.has(conversationIDKey))) {
      return
    }

    const firstGood = inbox.find(i => !i.get('isEmpty') || alwaysShow.has(i.get('conversationIDKey')))
    if (firstGood && !isMobile) {
      const conversationIDKey = firstGood.get('conversationIDKey')
      yield put(selectConversation(conversationIDKey, false))
    } else {
      yield put(selectConversation(null, false))
    }
  }
}

const followingSelector = (state: TypedState) => state.config.following

let _loadedInboxOnce = false
function * _loadInboxMaybeOnce (action: LoadInbox): SagaGenerator<any, any> {
  if (!_loadedInboxOnce || action.payload.force) {
    _loadedInboxOnce = true
    yield call(_loadInbox)
  }
}

function * _loadInbox (): SagaGenerator<any, any> {
  const channelConfig = singleFixedChannelConfig([
    'chat.1.chatUi.chatInboxUnverified',
    'chat.1.chatUi.chatInboxConversation',
    'chat.1.chatUi.chatInboxFailed',
    'finished',
  ])

  const loadInboxChanMap: ChannelMap<any> = localGetInboxNonblockLocalRpcChannelMap(channelConfig, {
    param: {
      query: {
        status: Object.keys(CommonConversationStatus).filter(k => !['ignored', 'blocked'].includes(k)).map(k => CommonConversationStatus[k]),
        computeActiveList: true,
        tlfVisibility: CommonTLFVisibility.private,
        topicType: CommonTopicType.chat,
        unreadOnly: false,
        readOnly: false,
      },
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
    },
  })

  const chatInboxUnverified = yield takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxUnverified')

  if (!chatInboxUnverified) {
    throw new Error("Can't load inbox")
  }

  const metaData = ((yield select(_metaDataSelector)): any)
  const inbox: GetInboxLocalRes = chatInboxUnverified.params.inbox
  const author = yield select(usernameSelector)
  const following = yield select(followingSelector)
  const conversations: List<InboxState> = _inboxToConversations(inbox, author, following || {}, metaData)
  const finalizedState: FinalizedState = _inboxToFinalized(inbox)

  yield put(loadedInbox(conversations))
  if (finalizedState.count()) {
    yield put(({type: 'chat:updateFinalizedState', payload: {finalizedState}}: Constants.UpdateFinalizedState))
  }

  chatInboxUnverified.response.result()

  let finishedCalled = false
  while (!finishedCalled) {
    const incoming: {[key: string]: any} = yield race({
      chatInboxConversation: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxConversation'),
      chatInboxFailed: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxFailed'),
      finished: takeFromChannelMap(loadInboxChanMap, 'finished'),
      timeout: call(delay, 30000),
    })

    if (incoming.chatInboxConversation) {
      requestIdleCallback(() => {
        incoming.chatInboxConversation.response.result()
      }, {timeout: 100})

      yield call(delay, 1)
      let conversation: ?InboxState = _inboxConversationToInboxState(incoming.chatInboxConversation.params.conv, author, following || {}, metaData)

      // TODO this is ugly, ideally we should just call _updateInbox here
      const conv = incoming.chatInboxConversation.params.conv
      const supersedesState: Constants.SupersedesState = _inboxConversationLocalToSupersedesState(conv)
      const supersededByState: Constants.SupersededByState = _inboxConversationLocalToSupersededByState(conv)
      const finalizedState: Constants.FinalizedState = _conversationLocalToFinalized(conv)

      if (supersedesState.count()) {
        yield put(({type: 'chat:updateSupersedesState', payload: {supersedesState}}: Constants.UpdateSupersedesState))
      }
      if (supersededByState.count()) {
        yield put(({type: 'chat:updateSupersededByState', payload: {supersededByState}}: Constants.UpdateSupersededByState))
      }
      if (finalizedState.count()) {
        yield put(({type: 'chat:updateFinalizedState', payload: {finalizedState}}: Constants.UpdateFinalizedState))
      }

      if (conversation) {
        yield put(({type: 'chat:updateInbox', payload: {conversation}}: Constants.UpdateInbox))
        const selectedConversation = yield select(getSelectedConversation)
        if (selectedConversation === conversation.get('conversationIDKey')) {
          // load validated selected
          yield put(loadMoreMessages(selectedConversation, false))
        }
      }
      // find it
    } else if (incoming.chatInboxFailed) {
      console.log('ignoring chatInboxFailed', incoming.chatInboxFailed)
      requestIdleCallback(() => {
        incoming.chatInboxFailed.response.result()
      }, {timeout: 100})

      yield call(delay, 1)
      const error = incoming.chatInboxFailed.params.error
      const conversationIDKey = conversationIDToKey(incoming.chatInboxFailed.params.convID)
      const conversation = new InboxStateRecord({
        info: null,
        isEmpty: false,
        conversationIDKey,
        participants: List([].concat(error.rekeyInfo ? error.rekeyInfo.writerNames : [], error.rekeyInfo ? error.rekeyInfo.readerNames : []).filter(Boolean)),
        status: 'unfiled',
        time: error.remoteConv.readerInfo.mtime,
        snippet: null,
        validated: true,
      })
      yield put(({type: 'chat:updateInbox', payload: {conversation}}: Constants.UpdateInbox))

      switch (error.typ) {
        case LocalConversationErrorType.selfrekeyneeded: {
          yield put({type: 'chat:updateInboxRekeySelf', payload: {conversationIDKey}})
          break
        }
        case LocalConversationErrorType.otherrekeyneeded: {
          const rekeyers = error.rekeyInfo.rekeyers
          yield put({type: 'chat:updateInboxRekeyOthers', payload: {conversationIDKey, rekeyers}})
          break
        }
        default:
          if (__DEV__) {
            console.warn('Inbox error:', error)
          }
      }
    } else if (incoming.finished) {
      finishedCalled = true
      yield put({type: 'chat:updateInboxComplete', payload: undefined})
      break
    } else if (incoming.timeout) {
      console.warn('Inbox loading timed out')
      yield put({type: 'chat:updateInboxComplete', payload: undefined})
      break
    }
  }
}

function * _loadMoreMessages (action: LoadMoreMessages): SagaGenerator<any, any> {
  const conversationIDKey = action.payload.conversationIDKey

  if (!conversationIDKey) {
    return
  }

  if (isPendingConversationIDKey(conversationIDKey)) {
    __DEV__ && console.log('Bailing on selected pending conversation no matching inbox')
    return
  }

  const inboxConvo = yield select(_selectedInboxSelector, conversationIDKey)

  if (inboxConvo && !inboxConvo.validated) {
    __DEV__ && console.log('Bailing on not yet validated conversation')
    return
  }

  const rekeyInfoSelector = (state: TypedState, conversationIDKey: ConversationIDKey) => {
    return state.chat.get('rekeyInfos').get(conversationIDKey)
  }
  const rekeyInfo = yield select(rekeyInfoSelector, conversationIDKey)

  if (rekeyInfo) {
    __DEV__ && console.log('Bailing on chat due to rekey info')
    return
  }

  const oldConversationState = yield select(_conversationStateSelector, conversationIDKey)

  let next
  if (oldConversationState) {
    if (action.payload.onlyIfUnloaded && oldConversationState.get('isLoaded')) {
      __DEV__ && console.log('Bailing on chat load more due to already has initial load')
      return
    }

    if (oldConversationState.get('isRequesting')) {
      __DEV__ && console.log('Bailing on chat load more due to isRequesting already')
      return
    }

    if (!oldConversationState.get('moreToLoad')) {
      __DEV__ && console.log('Bailing on chat load more due to no more to load')
      return
    }

    next = oldConversationState.get('paginationNext', undefined)
  }

  yield put({type: 'chat:loadingMessages', payload: {conversationIDKey}})

  // We receive the list with edit/delete/etc already applied so lets filter that out
  const messageTypes = Object.keys(CommonMessageType).filter(k => !['edit', 'delete', 'headline', 'attachmentuploaded'].includes(k)).map(k => CommonMessageType[k])
  const conversationID = keyToConversationID(conversationIDKey)

  const thread = yield call(localGetThreadLocalRpcPromise, {param: {
    conversationID,
    query: {
      markAsRead: true,
      messageTypes,
    },
    pagination: {
      next,
      num: Constants.maxMessagesToLoadAtATime,
    },
    identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
  }})

  const yourName = yield select(usernameSelector)
  const yourDeviceName = yield select(_devicenameSelector)
  const messages = (thread && thread.thread && thread.thread.messages || []).map(message => _unboxedToMessage(message, yourName, yourDeviceName, conversationIDKey)).reverse()
  let newMessages = []
  messages.forEach((message, idx) => {
    if (idx > 0) {
      const timestamp = _maybeAddTimestamp(messages[idx], messages[idx - 1])
      if (timestamp !== null) {
        newMessages.push(timestamp)
      }
    }
    newMessages.push(message)
  })

  const pagination = _threadToPagination(thread)

  yield put({
    payload: {
      conversationIDKey,
      messages: newMessages,
      moreToLoad: !pagination.last,
      paginationNext: pagination.next,
    },
    logTransformer: prependMessagesActionTransformer,
    type: 'chat:prependMessages',
  })

  // Load previews for attachments
  const attachmentsOnly = messages.reduce((acc: List<Constants.AttachmentMessage>, m) => m && m.type === 'Attachment' && m.messageID ? acc.push(m) : acc, new List())
  // $FlowIssue we check for messageID existance above
  yield attachmentsOnly.map(({conversationIDKey, messageID, filename}: Constants.AttachmentMessage) => put(loadAttachment(conversationIDKey, messageID, true, false, tmpFile(_tmpFileName(false, conversationIDKey, messageID, filename))))).toArray()
}

function _threadToPagination (thread) {
  if (thread && thread.thread && thread.thread.pagination) {
    return thread.thread.pagination
  }
  return {
    last: undefined,
    next: undefined,
  }
}

type TimestampableMessage = {
  timestamp: number,
  messageID: MessageID,
  type: any,
}

function _filterTimestampableMessage (message: Message): ?TimestampableMessage {
  if (message.messageID === 1) {
    // $FlowIssue with casting todo(mm) can we fix this?
    return message
  }

  if (message === null || message.type === 'Timestamp' || ['Timestamp', 'Deleted', 'Unhandled', 'InvisibleError', 'Edit'].includes(message.type)) {
    return null
  }

  if (!message.timestamp) {
    return null
  }

  // $FlowIssue with casting todo(mm) can we fix this?
  return message
}

function _maybeAddTimestamp (_message: Message, _prevMessage: Message): MaybeTimestamp {
  const prevMessage = _filterTimestampableMessage(_prevMessage)
  const message = _filterTimestampableMessage(_message)
  if (!message || !prevMessage) return null

  // messageID 1 is an unhandled placeholder. We want to add a timestamp before
  // the first message, as well as between any two messages with long duration.
  if (prevMessage.messageID === 1 || message.timestamp - prevMessage.timestamp > Constants.howLongBetweenTimestampsMs) {
    return {
      type: 'Timestamp',
      timestamp: message.timestamp,
      key: Constants.messageKey('timestamp', message.timestamp),
    }
  }
  return null
}

// used to key errors
let errorIdx = 1

function _decodeFailureDescription (typ: ChatTypes.OutboxErrorType): string {
  switch (typ) {
    case ChatTypes.LocalOutboxErrorType.misc:
      return 'unknown error'
    case ChatTypes.LocalOutboxErrorType.offline:
      return 'disconnected from chat server'
    case ChatTypes.LocalOutboxErrorType.identify:
      return 'proofs failed for recipient user'
    case ChatTypes.LocalOutboxErrorType.toolong:
      return 'message is too long'
  }
  return `unknown error type ${typ}`
}

function _unboxedToMessage (message: MessageUnboxed, yourName, yourDeviceName, conversationIDKey: ConversationIDKey): Message {
  if (message && message.state === LocalMessageUnboxedState.outbox && message.outbox) {
    // Outbox messages are always text, not attachments.
    const payload: OutboxRecord = message.outbox
    const messageState: MessageState = (payload && payload.state && payload.state.state === ChatTypes.LocalOutboxStateType.error) ? 'failed' : 'pending'
    const messageBody: MessageBody = payload.Msg.messageBody
    // $FlowIssue
    const failureDescription = messageState === 'failed' ? _decodeFailureDescription(payload.state.error.typ) : null
    // $FlowIssue
    const messageText: MessageText = messageBody.text
    return {
      author: yourName,
      conversationIDKey,
      deviceName: yourDeviceName,
      deviceType: isMobile ? 'mobile' : 'desktop',
      editedCount: 0,
      failureDescription,
      key: Constants.messageKey('outboxID', payload.outboxID),
      message: new HiddenString(messageText && messageText.body || ''),
      messageState,
      outboxID: outboxIDToKey(payload.outboxID),
      senderDeviceRevokedAt: null,
      timestamp: payload.ctime,
      type: 'Text',
      you: yourName,
    }
  }

  if (message.state === LocalMessageUnboxedState.valid) {
    const payload = message.valid
    if (payload) {
      const common = {
        author: payload.senderUsername,
        conversationIDKey,
        deviceName: payload.senderDeviceName,
        deviceType: toDeviceType(payload.senderDeviceType),
        failureDescription: null,
        messageID: payload.serverHeader.messageID,
        senderDeviceRevokedAt: payload.senderDeviceRevokedAt,
        timestamp: payload.serverHeader.ctime,
        you: yourName,
      }

      switch (payload.messageBody.messageType) {
        case CommonMessageType.text:
          const outboxID = payload.clientHeader.outboxID && outboxIDToKey(payload.clientHeader.outboxID)
          return {
            type: 'Text',
            ...common,
            editedCount: payload.serverHeader.supersededBy ? 1 : 0, // mark it as edited if it's been superseded
            message: new HiddenString(payload.messageBody && payload.messageBody.text && payload.messageBody.text.body || ''),
            messageState: 'sent', // TODO, distinguish sent/pending once CORE sends it.
            outboxID,
            key: Constants.messageKey('messageID', common.messageID),
          }
        case CommonMessageType.attachment: {
          if (!payload.messageBody.attachment) {
            throw new Error('empty attachment body')
          }
          const attachment: ChatTypes.MessageAttachment = payload.messageBody.attachment
          const preview = attachment && attachment.preview
          const mimeType = preview && preview.mimeType
          const previewMetadata = preview && preview.metadata
          const previewSize = previewMetadata && Constants.parseMetadataPreviewSize(previewMetadata)

          const previewIsVideo = previewMetadata && previewMetadata.assetType === LocalAssetMetadataType.video
          let previewDurationMs = null
          if (previewIsVideo) {
            const previewVideoMetadata = previewMetadata && previewMetadata.assetType === LocalAssetMetadataType.video && previewMetadata.video
            previewDurationMs = previewVideoMetadata ? previewVideoMetadata.durationMs : null
          }

          const objectMetadata = attachment && attachment.object && attachment.object.metadata
          const objectIsVideo = objectMetadata && objectMetadata.assetType === LocalAssetMetadataType.video
          let attachmentDurationMs = null
          if (objectIsVideo) {
            const objectVideoMetadata = objectMetadata && objectMetadata.assetType === LocalAssetMetadataType.video && objectMetadata.video
            attachmentDurationMs = objectVideoMetadata ? objectVideoMetadata.durationMs : null
          }

          let messageState
          if (attachment.uploaded) {
            messageState = 'sent'
          } else {
            messageState = common.author === common.you ? 'uploading' : 'placeholder'
          }

          return {
            type: 'Attachment',
            ...common,
            filename: attachment.object.filename,
            title: attachment.object.title,
            messageState,
            previewDurationMs,
            attachmentDurationMs,
            previewType: mimeType && mimeType.indexOf('image') === 0 ? 'Image' : 'Other',
            previewPath: null,
            hdPreviewPath: null,
            previewSize,
            downloadedPath: null,
            key: Constants.messageKey('messageID', common.messageID),
          }
        }
        case CommonMessageType.attachmentuploaded: {
          if (!payload.messageBody.attachmentuploaded) {
            throw new Error('empty attachmentuploaded body')
          }
          const attachmentUploaded: ChatTypes.MessageAttachmentUploaded = payload.messageBody.attachmentuploaded
          const previews = attachmentUploaded && attachmentUploaded.previews
          const preview = previews && previews[0]
          const mimeType = preview && preview.mimeType
          const previewSize = preview && preview.metadata && Constants.parseMetadataPreviewSize(preview.metadata)

          return {
            key: Constants.messageKey('messageID', common.messageID),
            messageID: common.messageID,
            targetMessageID: attachmentUploaded.messageID,
            timestamp: common.timestamp,
            type: 'UpdateAttachment',
            updates: {
              filename: attachmentUploaded.object.filename,
              messageState: 'sent',
              previewType: mimeType && mimeType.indexOf('image') === 0 ? 'Image' : 'Other',
              previewSize,
              title: attachmentUploaded.object.title,
            },
          }
        }
        case CommonMessageType.delete:
          const deletedIDs = payload.messageBody.delete && payload.messageBody.delete.messageIDs || []
          return {
            type: 'Deleted',
            timestamp: payload.serverHeader.ctime,
            messageID: payload.serverHeader.messageID,
            key: Constants.messageKey('messageID', common.messageID),
            deletedIDs,
          }
        case CommonMessageType.edit: {
          const message = new HiddenString(payload.messageBody && payload.messageBody.edit && payload.messageBody.edit.body || '')
          const outboxID = payload.clientHeader.outboxID && outboxIDToKey(payload.clientHeader.outboxID)
          const targetMessageID = payload.messageBody.edit ? payload.messageBody.edit.messageID : 0
          return {
            key: Constants.messageKey('messageID', common.messageID),
            message,
            messageID: common.messageID,
            outboxID,
            targetMessageID,
            timestamp: common.timestamp,
            type: 'Edit',
          }
        }
        default:
          const unhandled: UnhandledMessage = {
            ...common,
            key: Constants.messageKey('messageID', common.messageID),
            type: 'Unhandled',
          }
          return unhandled
      }
    }
  }

  if (message.state === LocalMessageUnboxedState.error) {
    const error = message.error
    if (error) {
      switch (error.errType) {
        case LocalMessageUnboxedErrorType.misc:
        case LocalMessageUnboxedErrorType.badversionCritical: // fallthrough
        case LocalMessageUnboxedErrorType.identify: // fallthrough
          return {
            conversationIDKey,
            key: Constants.messageKey('error', errorIdx++),
            messageID: error.messageID,
            reason: error.errMsg || '',
            timestamp: error.ctime,
            type: 'Error',
          }
        case LocalMessageUnboxedErrorType.badversion:
          return {
            conversationIDKey,
            key: Constants.messageKey('error', errorIdx++),
            data: message,
            messageID: error.messageID,
            timestamp: error.ctime,
            type: 'InvisibleError',
          }
      }
    }
  }

  return {
    type: 'Error',
    key: Constants.messageKey('error', errorIdx++),
    data: message,
    reason: "The message couldn't be loaded",
    conversationIDKey,
  }
}

function * _openTlfInChat (action: OpenTlfInChat): SagaGenerator<any, any> {
  const tlf = action.payload
  const me = yield select(usernameSelector)
  const userlist = parseFolderNameToUsers(me, tlf)
  const users = userlist.map(u => u.username)
  if (some(userlist, 'readOnly')) {
    console.warn('Bug: openTlfToChat should never be called on a convo with readOnly members.')
    return
  }
  yield put(startConversation(users))
}

function * _startConversation (action: StartConversation): SagaGenerator<any, any> {
  const {users, forceImmediate} = action.payload

  const inboxSelector = (state: TypedState, tlfName: string) => {
    return state.chat.get('inbox').find(convo => convo.get('participants').sort().join(',') === tlfName)
  }
  const tlfName = users.sort().join(',')
  const existing = yield select(inboxSelector, tlfName)

  if (forceImmediate && existing) {
    yield call(_startNewConversation, existing.get('conversationIDKey'))
  } else if (existing) { // Select existing conversations
    yield put(selectConversation(existing.get('conversationIDKey'), false))
    yield put(switchTo([chatTab]))
  } else {
    // Make a pending conversation so it appears in the inbox
    const conversationIDKey = pendingConversationIDKey(tlfName)
    yield put(addPending(users))
    yield put(selectConversation(conversationIDKey, false))
    yield put(switchTo([chatTab]))
  }
}

function * _openFolder (): SagaGenerator<any, any> {
  const conversationIDKey = yield select(getSelectedConversation)

  const inbox = yield select(_selectedInboxSelector, conversationIDKey)
  if (inbox) {
    const helper = inbox.get('info').visibility === CommonTLFVisibility.public ? publicFolderWithUsers : privateFolderWithUsers
    const path = helper(inbox.get('participants').toArray())
    yield put(openInKBFS(path))
  } else {
    throw new Error(`Can't find conversation path`)
  }
}

function * _newChat (action: NewChat): SagaGenerator<any, any> {
  yield put(searchReset())

  const metaData = ((yield select(_metaDataSelector)): any)

  const following = (yield select(followingSelector)) || {}

  yield put(searchAddUsersToGroup(action.payload.existingParticipants.map(username => ({
    service: 'keybase',
    username,
    isFollowing: !!following[username],
    extraInfo: {
      service: 'none',
      fullName: metaData.getIn([username, 'fullname'], 'Unknown'),
    },
  }))))
  yield put(switchTo([searchTab]))
}

function * _updateMetadata (action: UpdateMetadata): SagaGenerator<any, any> {
  // Don't send sharing before signup values
  const metaData = yield select(_metaDataSelector)
  const usernames = action.payload.users.filter(name => metaData.getIn([name, 'fullname']) === undefined && name.indexOf('@') === -1)
  if (!usernames.length) {
    return
  }

  const results: any = yield call(apiserverGetRpcPromise, {
    param: {
      endpoint: 'user/lookup',
      args: [
        {key: 'usernames', value: usernames.join(',')},
        {key: 'fields', value: 'profile'},
      ],
    },
  })

  const parsed = JSON.parse(results.body)
  const payload = {}
  usernames.forEach((username, idx) => {
    const record = parsed.them[idx]
    const fullname = (record && record.profile && record.profile.full_name) || ''
    payload[username] = new MetaDataRecord({fullname})
  })

  yield put({
    type: 'chat:updatedMetadata',
    payload,
  })
}

function * _selectConversation (action: SelectConversation): SagaGenerator<any, any> {
  const {conversationIDKey, fromUser} = action.payload
  const oldConversationState = yield select(_conversationStateSelector, conversationIDKey)
  if (oldConversationState && oldConversationState.get('isStale')) {
    yield put({type: 'chat:clearMessages', payload: {conversationIDKey}})
  }

  let loadMoreTask
  if (conversationIDKey) {
    loadMoreTask = yield fork(cancelWhen(_threadIsCleared, _loadMoreMessages), loadMoreMessages(conversationIDKey, true))
    yield put(navigateTo([conversationIDKey], [chatTab]))
  } else {
    yield put(navigateTo([], [chatTab]))
  }

  const inbox = yield select(_selectedInboxSelector, conversationIDKey)
  if (inbox) {
    yield put({type: 'chat:updateMetadata', payload: {users: inbox.get('participants').toArray()}})
  }

  if (inbox && !inbox.get('validated')) {
    return
  }

  if (fromUser && conversationIDKey) {
    yield join(loadMoreTask)
    yield put(updateBadging(conversationIDKey))
    yield put(updateLatestMessage(conversationIDKey))
  }
}

function * _blockConversation (action: BlockConversation): SagaGenerator<any, any> {
  const {blocked, conversationIDKey} = action.payload
  const conversationID = keyToConversationID(conversationIDKey)
  const status = blocked ? CommonConversationStatus.blocked : CommonConversationStatus.unfiled
  const identifyBehavior: TLFIdentifyBehavior = TlfKeysTLFIdentifyBehavior.chatGui
  yield call(localSetConversationStatusLocalRpcPromise, {
    param: {conversationID, identifyBehavior, status},
  })
}

function * _muteConversation (action: MuteConversation): SagaGenerator<any, any> {
  const {conversationIDKey, muted} = action.payload
  const conversationID = keyToConversationID(conversationIDKey)
  const status = muted ? CommonConversationStatus.muted : CommonConversationStatus.unfiled
  const identifyBehavior: TLFIdentifyBehavior = TlfKeysTLFIdentifyBehavior.chatGui
  yield call(localSetConversationStatusLocalRpcPromise, {
    param: {conversationID, identifyBehavior, status},
  })
}

function * _updateBadging (action: UpdateBadging): SagaGenerator<any, any> {
  // Update gregor's view of the latest message we've read.
  const {conversationIDKey} = action.payload
  const conversationState = yield select(_conversationStateSelector, conversationIDKey)
  if (conversationState && conversationState.messages !== null && conversationState.messages.size > 0) {
    const conversationID = keyToConversationID(conversationIDKey)
    const msgID = conversationState.messages.get(conversationState.messages.size - 1).messageID
    yield call(localMarkAsReadLocalRpcPromise, {
      param: {conversationID, msgID},
    })
  }
}

function * _changedFocus (action: ChangedFocus): SagaGenerator<any, any> {
  // Update badging and the latest message due to the refocus.
  const appFocused = action.payload
  const conversationIDKey = yield select(getSelectedConversation)
  const selectedTab = yield select(_routeSelector)
  const chatTabSelected = (selectedTab === chatTab)

  if (conversationIDKey && appFocused && chatTabSelected) {
    yield put(updateBadging(conversationIDKey))
    yield put(updateLatestMessage(conversationIDKey))
  }
}

function * _badgeAppForChat (action: BadgeAppForChat): SagaGenerator<any, any> {
  const conversations = action.payload
  const selectedConversationIDKey = yield select(getSelectedConversation)
  const windowFocused = yield select(_focusedSelector)

  const newConversations = conversations.reduce((acc, conv) => {
    // Badge this conversation if it's unread and either the app doesn't have
    // focus (so the user didn't see the message) or the conversation isn't
    // selected (same).
    const unread = conv.get('UnreadMessages') > 0
    const selected = (conversationIDToKey(conv.get('convID')) === selectedConversationIDKey)
    const addThisConv = (unread && (!selected || !windowFocused))
    return addThisConv ? acc + 1 : acc
  }, 0)
  yield put(badgeApp('chatInbox', newConversations > 0, newConversations))

  let conversationsWithKeys = {}
  conversations.map(conv => {
    conversationsWithKeys[conversationIDToKey(conv.get('convID'))] = conv.get('UnreadMessages')
  })
  const conversationUnreadCounts = Map(conversationsWithKeys)
  yield put({
    payload: conversationUnreadCounts,
    type: 'chat:updateConversationUnreadCounts',
  })
}

const _temporaryAttachmentMessageForUpload = (convID: ConversationIDKey, username: string, title: string, filename: string, outboxID: Constants.OutboxIDKey, previewType: $PropertyType<Constants.AttachmentMessage, 'previewType'>, previewSize: $PropertyType<Constants.AttachmentMessage, 'previewSize'>) => ({
  type: 'Attachment',
  timestamp: Date.now(),
  conversationIDKey: convID,
  followState: 'You',
  author: username,
  // TODO we should be able to fill this in
  deviceName: '',
  deviceType: isMobile ? 'mobile' : 'desktop',
  filename,
  title,
  previewType,
  previewSize,
  previewPath: filename,
  downloadedPath: null,
  outboxID,
  progress: 0,
  messageState: 'uploading',
  key: Constants.messageKey('tempAttachment', outboxID),
})

function * _selectAttachment ({payload: {input}}: Constants.SelectAttachment): SagaGenerator<any, any> {
  const {title, filename, type} = input
  let {conversationIDKey} = input

  if (isPendingConversationIDKey(conversationIDKey)) {
    // Get a real conversationIDKey
    conversationIDKey = yield call(_startNewConversation, conversationIDKey)
    if (!conversationIDKey) {
      return
    }
  }

  const outboxID = `attachmentUpload-${Math.ceil(Math.random() * 1e9)}`
  const username = yield select(usernameSelector)

  yield put({
    logTransformer: appendMessageActionTransformer,
    payload: {
      conversationIDKey,
      messages: [_temporaryAttachmentMessageForUpload(
        conversationIDKey,
        username,
        title,
        filename,
        outboxID,
        type,
      )],
    },
    type: 'chat:appendMessages',
  })

  const clientHeader = yield call(_clientHeader, CommonMessageType.attachment, conversationIDKey)
  const attachment = {
    filename,
  }
  const param = {
    conversationID: keyToConversationID(conversationIDKey),
    clientHeader,
    attachment,
    title,
    metadata: null,
    identifyBehavior: yield call(_getPostingIdentifyBehavior, conversationIDKey),
  }

  const channelConfig = singleFixedChannelConfig([
    'chat.1.chatUi.chatAttachmentUploadStart',
    'chat.1.chatUi.chatAttachmentPreviewUploadStart',
    'chat.1.chatUi.chatAttachmentUploadProgress',
    'chat.1.chatUi.chatAttachmentUploadDone',
    'chat.1.chatUi.chatAttachmentPreviewUploadDone',
    'finished',
  ])

  const channelMap = ((yield call(localPostFileAttachmentLocalRpcChannelMap, channelConfig, {param})): any)

  const uploadStart = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadStart')
  uploadStart.response.result()

  const finishedTask = yield fork(function * () {
    const finished = yield takeFromChannelMap(channelMap, 'finished')
    if (finished.error) {
      yield put(updateTempMessage(
        conversationIDKey,
        {messageState: 'failed'},
        outboxID
      ))
    }
    return finished
  })

  const progressTask = yield effectOnChannelMap(c => safeTakeEvery(c, function * ({response}) {
    const {bytesComplete, bytesTotal} = response.param
    const action: Constants.UploadProgress = {
      type: 'chat:uploadProgress',
      payload: {bytesTotal, bytesComplete, conversationIDKey, outboxID},
    }
    yield put(action)
    response.result()
  }), channelMap, 'chat.1.chatUi.chatAttachmentUploadProgress')

  const previewTask = yield fork(function * () {
    const previewUploadStart = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentPreviewUploadStart')
    previewUploadStart.response.result()

    const metadata = previewUploadStart.params && previewUploadStart.params.metadata
    const previewSize = metadata && Constants.parseMetadataPreviewSize(metadata) || null

    yield put({
      logTransformer: appendMessageActionTransformer,
      payload: {
        conversationIDKey,
        messages: [_temporaryAttachmentMessageForUpload(
          conversationIDKey,
          username,
          title,
          filename,
          outboxID,
          type,
          previewSize,
        )],
      },
      type: 'chat:appendMessages',
    })

    const previewUploadDone = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentPreviewUploadDone')
    previewUploadDone.response.result()
  })

  const uploadDone = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadDone')
  uploadDone.response.result()

  const finished = yield join(finishedTask)
  yield cancel(progressTask)
  yield cancel(previewTask)
  closeChannelMap(channelMap)

  if (!finished.error) {
    const {params: {messageID}} = finished
    const existingMessage = yield select(_messageSelector, conversationIDKey, messageID)
    // We already received a message for this attachment
    if (existingMessage) {
      yield put(({
        type: 'chat:deleteTempMessage',
        payload: {
          conversationIDKey,
          outboxID,
        },
      }: Constants.DeleteTempMessage))
    } else {
      yield put(updateTempMessage(
        conversationIDKey,
        {type: 'Attachment', messageState: 'sent', messageID, key: Constants.messageKey('messageID', messageID)},
        outboxID,
      ))
    }

    yield put(({
      type: 'chat:markSeenMessage',
      payload: {
        conversationIDKey,
        messageID: messageID,
      },
    }: Constants.MarkSeenMessage))
  }
}

// Instead of redownloading the full attachment again, we may have it cached from an earlier hdPreview
// returns cached filepath
function * _isCached (conversationIDKey, messageID): Generator<any, ?string, any> {
  try {
    const message = yield select(_messageSelector, conversationIDKey, messageID)
    if (message.hdPreviewPath) {
      return message.hdPreviewPath
    }
  } catch (e) {
    console.warn('error in checking cached file', e)
    return
  }
}

// TODO load previews too
function * _loadAttachment ({payload: {conversationIDKey, messageID, loadPreview, isHdPreview, filename}}: Constants.LoadAttachment): SagaGenerator<any, any> {
  // See if we already have this image cached
  if (loadPreview || isHdPreview) {
    const imageCached = yield call(exists, filename)
    if (imageCached) {
      const action: Constants.AttachmentLoaded = {
        type: 'chat:attachmentLoaded',
        payload: {conversationIDKey, messageID, path: filename, isPreview: loadPreview, isHdPreview: isHdPreview},
      }
      yield put(action)
      return
    }
  }

  // If we are loading the actual attachment,
  // let's see if we've already downloaded it as an hdPreview
  if (!loadPreview && !isHdPreview) {
    const cachedPath = yield call(_isCached, conversationIDKey, messageID)

    if (cachedPath) {
      copy(cachedPath, filename)

      // for visual feedback, we'll briefly display a progress bar
      for (let i = 0; i < 5; i++) {
        const fakeProgressAction: Constants.DownloadProgress = {
          type: 'chat:downloadProgress',
          payload: {conversationIDKey, messageID, isPreview: false, bytesComplete: i + 1, bytesTotal: 5},
        }
        yield put(fakeProgressAction)
        yield delay(5)
      }

      const action: Constants.AttachmentLoaded = {
        type: 'chat:attachmentLoaded',
        payload: {conversationIDKey, messageID, path: filename, isPreview: loadPreview, isHdPreview: isHdPreview},
      }
      yield put(action)
      return
    }
  }

  const param = {
    conversationID: keyToConversationID(conversationIDKey),
    messageID,
    filename,
    preview: loadPreview,
    identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
  }

  const channelConfig = singleFixedChannelConfig([
    'chat.1.chatUi.chatAttachmentDownloadStart',
    'chat.1.chatUi.chatAttachmentDownloadProgress',
    'chat.1.chatUi.chatAttachmentDownloadDone',
  ])

  const channelMap = ((yield call(localDownloadFileAttachmentLocalRpcChannelMap, channelConfig, {param})): any)

  const progressTask = yield effectOnChannelMap(c => safeTakeEvery(c, function * ({response}) {
    const {bytesComplete, bytesTotal} = response.param
    const action: Constants.DownloadProgress = {
      type: 'chat:downloadProgress',
      payload: {conversationIDKey, messageID, isPreview: loadPreview || isHdPreview, bytesTotal, bytesComplete},
    }
    yield put(action)
    response.result()
  }), channelMap, 'chat.1.chatUi.chatAttachmentDownloadProgress')

  {
    const {response} = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentDownloadStart')
    response.result()
  }

  {
    const {response} = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentDownloadDone')
    response.result()
  }

  yield cancel(progressTask)
  closeChannelMap(channelMap)

  const action: Constants.AttachmentLoaded = {
    type: 'chat:attachmentLoaded',
    payload: {conversationIDKey, messageID, path: filename, isPreview: loadPreview, isHdPreview: isHdPreview},
  }
  yield put(action)
}

function * _sendNotifications (action: AppendMessages): SagaGenerator<any, any> {
  const appFocused = yield select(_focusedSelector)
  const selectedTab = yield select(_routeSelector)
  const chatTabSelected = (selectedTab === chatTab)
  const convoIsSelected = action.payload.isSelected

  // Only send if you're not looking at it
  if (!convoIsSelected || !appFocused || !chatTabSelected) {
    const me = yield select(usernameSelector)
    const message = (action.payload.messages.reverse().find(m => m.type === 'Text' && m.author !== me))
    // Is this message part of a muted conversation? If so don't notify.
    const convo = yield select(_selectedInboxSelector, action.payload.conversationIDKey)
    if (convo && !convo.muted) {
      if (message && message.type === 'Text') {
        const snippet = makeSnippet(serverMessageToMessageBody(message))
        yield put((dispatch: Dispatch) => {
          NotifyPopup(message.author, {body: snippet}, -1, message.author, () => {
            dispatch(selectConversation(action.payload.conversationIDKey, false))
            dispatch(switchTo([chatTab]))
            dispatch(showMainWindow())
          })
        })
      }
    }
  }
}

function * _markThreadsStale (action: MarkThreadsStale): SagaGenerator<any, any> {
  // Load inbox items of any stale items so we get update on rekeyInfos, etc
  const {convIDs} = action.payload
  yield convIDs.map(conversationIDKey => call(_getInboxAndUnbox, {payload: {conversationIDKey}, type: 'chat:getInboxAndUnbox'}))

  // Selected is stale?
  const selectedConversation = yield select(getSelectedConversation)
  if (!selectedConversation) {
    return
  }
  yield put({type: 'chat:clearMessages', payload: {conversationIDKey: selectedConversation}})
  yield put(loadMoreMessages(selectedConversation, false))
}

function * _openAttachmentPopup (action: OpenAttachmentPopup): SagaGenerator<any, any> {
  const {message} = action.payload
  const messageID = message.messageID
  if (!messageID) {
    throw new Error('Cannot open attachment popup for message missing ID')
  }

  yield put(navigateAppend([{props: {messageID, conversationIDKey: message.conversationIDKey}, selected: 'attachment'}]))
  if (!message.hdPreviewPath && message.filename) {
    yield put(loadAttachment(message.conversationIDKey, messageID, false, true, tmpFile(_tmpFileName(true, message.conversationIDKey, message.messageID, message.filename))))
  }
}

function _threadIsCleared (originalAction: Action, checkAction: Action): boolean {
  return originalAction.type === 'chat:loadMoreMessages' && checkAction.type === 'chat:clearMessages' && originalAction.conversationIDKey === checkAction.conversationIDKey
}

function * _getInboxAndUnbox ({payload: {conversationIDKey}}: Constants.GetInboxAndUnbox) {
  const param: ChatTypes.localGetInboxAndUnboxLocalRpcParam = {
    identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
    query: {
      convIDs: [keyToConversationID(conversationIDKey)],
      computeActiveList: true,
      tlfVisibility: CommonTLFVisibility.private,
      topicType: CommonTopicType.chat,
      unreadOnly: false,
      readOnly: true,
    },
  }

  const result: ChatTypes.GetInboxAndUnboxLocalRes = yield call(ChatTypes.localGetInboxAndUnboxLocalRpcPromise, {param})
  const {conversations} = result
  if (conversations && conversations[0]) {
    yield call(_updateInbox, conversations[0])
    // inbox loaded so rekeyInfo is now clear
    yield put({payload: {conversationIDKey}, type: 'chat:clearRekey'})
  }
  // TODO maybe we get failures and we should update rekeyinfo? unclear...
}

function * _openConversation ({payload: {conversationIDKey}}: Constants.OpenConversation): SagaGenerator<any, any> {
  const inbox = yield select(inboxSelector)
  const validInbox = inbox.find(c => c.get('conversationIDKey') === conversationIDKey && c.get('validated'))
  if (!validInbox) {
    yield put(({type: 'chat:getInboxAndUnbox', payload: {conversationIDKey}}: Constants.GetInboxAndUnbox))
    const raceResult: {[key: string]: any} = yield race({
      updateInbox: take(a => a.type === 'chat:updateInbox' && a.payload.conversation && a.payload.conversation.conversationIDKey === conversationIDKey),
      timeout: call(delay, 10e3),
    })
    if (raceResult.updateInbox) {
      yield put(selectConversation(conversationIDKey, false))
    }
    return
  } else {
    yield put(selectConversation(conversationIDKey, false))
  }
}

function * _shareAttachment ({payload: {message}}: Constants.ShareAttachment) {
  const {filename, messageID, conversationIDKey} = message
  if (!filename || !messageID) {
    return
  }

  const path = downloadFilePath(filename)
  yield call(_loadAttachment, ({
    type: 'chat:loadAttachment',
    payload: {
      conversationIDKey,
      messageID,
      loadPreview: false,
      isHdPreview: false,
      filename: path,
    },
  }: Constants.LoadAttachment))
  yield call(showShareActionSheet, {url: path})
}

function * _saveAttachmentNative ({payload: {message}}: Constants.SaveAttachment) {
  const {filename, messageID, conversationIDKey} = message
  if (!filename || !messageID) {
    return
  }

  const path = downloadFilePath(filename)
  yield call(_loadAttachment, ({
    type: 'chat:loadAttachment',
    payload: {
      conversationIDKey,
      messageID,
      loadPreview: false,
      isHdPreview: false,
      filename: path,
    },
  }: Constants.LoadAttachment))
  yield call(saveAttachment, path)
}

function * chatSaga (): SagaGenerator<any, any> {
  yield [
    safeTakeSerially('chat:loadInbox', _loadInboxMaybeOnce),
    safeTakeLatest('chat:inboxStale', _loadInbox),
    safeTakeEvery('chat:loadMoreMessages', cancelWhen(_threadIsCleared, _loadMoreMessages)),
    safeTakeLatest('chat:selectConversation', _selectConversation),
    safeTakeEvery('chat:updateBadging', _updateBadging),
    safeTakeEvery('chat:setupChatHandlers', _setupChatHandlers),
    safeTakeEvery('chat:incomingMessage', _incomingMessage),
    safeTakeEvery('chat:markThreadsStale', _markThreadsStale),
    safeTakeEvery('chat:muteConversation', _muteConversation),
    safeTakeEvery('chat:blockConversation', _blockConversation),
    safeTakeEvery('chat:newChat', _newChat),
    safeTakeEvery('chat:postMessage', _postMessage),
    safeTakeEvery('chat:editMessage', _editMessage),
    safeTakeEvery('chat:retryMessage', _retryMessage),
    safeTakeEvery('chat:startConversation', _startConversation),
    safeTakeEvery('chat:updateMetadata', _updateMetadata),
    safeTakeEvery('chat:appendMessages', _sendNotifications),
    safeTakeEvery('chat:selectAttachment', _selectAttachment),
    safeTakeEvery('chat:openConversation', _openConversation),
    safeTakeEvery('chat:getInboxAndUnbox', _getInboxAndUnbox),
    safeTakeEvery('chat:loadAttachment', _loadAttachment),
    safeTakeEvery('chat:openAttachmentPopup', _openAttachmentPopup),
    safeTakeLatest('chat:openFolder', _openFolder),
    safeTakeLatest('chat:badgeAppForChat', _badgeAppForChat),
    safeTakeEvery(changedFocus, _changedFocus),
    safeTakeEvery('chat:deleteMessage', _deleteMessage),
    safeTakeEvery('chat:openTlfInChat', _openTlfInChat),
    safeTakeEvery('chat:loadedInbox', _ensureValidSelectedChat, true, false),
    safeTakeEvery('chat:updateInboxComplete', _ensureValidSelectedChat, false, false),
    safeTakeEvery('chat:saveAttachmentNative', _saveAttachmentNative),
    safeTakeEvery('chat:shareAttachment', _shareAttachment),
  ]
}

export default chatSaga

export {
  badgeAppForChat,
  blockConversation,
  deleteMessage,
  editMessage,
  loadAttachment,
  loadInbox,
  loadMoreMessages,
  muteConversation,
  newChat,
  selectAttachment,
  openFolder,
  openTlfInChat,
  postMessage,
  retryAttachment,
  retryMessage,
  selectConversation,
  setupChatHandlers,
  startConversation,
  showEditor,
}
