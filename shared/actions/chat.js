// @flow
import * as Constants from '../constants/chat'
import HiddenString from '../util/hidden-string'
import engine from '../engine'
import {List, Map} from 'immutable'
import {NotifyPopup} from '../native/notifications'
import {apiserverGetRpcPromise, TlfKeysTLFIdentifyBehavior} from '../constants/types/flow-types'
import {badgeApp} from './notifications'
import {call, put, select, race, cancel, fork, join} from 'redux-saga/effects'
import {changedFocus} from '../constants/window'
import {delay} from 'redux-saga'
import {getPath} from '../route-tree'
import {navigateAppend, navigateTo, switchTo} from './route-tree'
import {openInKBFS} from './kbfs'
import {parseFolderNameToUsers} from '../util/kbfs'
import {publicFolderWithUsers, privateFolderWithUsers} from '../constants/config'
import {reset as searchReset, addUsersToGroup as searchAddUsersToGroup} from './search'
import {safeTakeEvery, safeTakeLatest, safeTakeSerially, singleFixedChannelConfig, cancelWhen, closeChannelMap, takeFromChannelMap, effectOnChannelMap} from '../util/saga'
import {searchTab, chatTab} from '../constants/tabs'
import {tmpFile, copy, exists} from '../util/file'
import {usernameSelector} from '../constants/selectors'
import {isMobile} from '../constants/platform'
import {toDeviceType} from '../constants/types/more'
import {showMainWindow} from './platform.specific'

import * as ChatTypes from '../constants/types/flow-types-chat'

import type {Action} from '../constants/types/flux'
import type {ChangedFocus} from '../constants/window'
import type {Asset, FailedMessageInfo, IncomingMessage as IncomingMessageRPCType, MessageBody, MessageText, MessageUnboxed, OutboxRecord, ConversationLocal, GetInboxLocalRes} from '../constants/types/flow-types-chat'
import type {SagaGenerator, ChannelMap} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'
import type {
  AppendMessages,
  BadgeAppForChat,
  ConversationBadgeState,
  ConversationIDKey,
  CreatePendingFailure,
  DeleteMessage,
  EditMessage,
  InboxState,
  IncomingMessage,
  LoadInbox,
  LoadMoreMessages,
  LoadedInbox,
  MarkThreadsStale,
  MaybeTimestamp,
  MetaData,
  Message,
  MessageID,
  MessageState,
  NewChat,
  OpenAttachmentPopup,
  OpenFolder,
  OutboxIDKey,
  PostMessage,
  RemoveOutboxMessage,
  RemovePendingFailure,
  RetryMessage,
  SelectConversation,
  SetupChatHandlers,
  StartConversation,
  UnhandledMessage,
  UpdateBadging,
  UpdateInbox,
  UpdateLatestMessage,
  UpdateMetadata,
} from '../constants/chat'

const {
  CommonConversationStatus,
  CommonMessageType,
  CommonTLFVisibility,
  CommonTopicType,
  LocalMessageUnboxedState,
  NotifyChatChatActivityType,
  localCancelPostRpcPromise,
  localDownloadFileAttachmentLocalRpcChannelMap,
  localGetInboxNonblockLocalRpcChannelMap,
  localGetThreadLocalRpcPromise,
  localMarkAsReadLocalRpcPromise,
  localNewConversationLocalRpcPromise,
  localPostFileAttachmentLocalRpcChannelMap,
  localPostLocalNonblockRpcPromise,
  localRetryPostRpcPromise,
} = ChatTypes

const {conversationIDToKey, keyToConversationID, keyToOutboxID, InboxStateRecord, MetaDataRecord, makeSnippet, outboxIDToKey, serverMessageToMessageBody, getBrokenUsers} = Constants

// Whitelisted action loggers
const loadedInboxActionTransformer = action => ({
  payload: {
    inbox: action.payload.inbox.map(i => {
      const {
        conversationIDKey,
        muted,
        time,
        validated,
        participants,
        info,
      } = i

      return {
        conversationIDKey,
        info: {
          status: info && info.status,
        },
        muted,
        participantsCount: participants.count(),
        time,
        validated,
      }
    }),
  },
  type: action.type,
})

const postMessageActionTransformer = action => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
  },
  type: action.type,
})

const retryMessageActionTransformer = action => ({
  payload: {
    conversationIDKey: action.payload.conversationIDKey,
    outboxIDKey: action.payload.outboxIDKey,
  },
  type: action.type,
})

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

const _selectedSelector = (state: TypedState) => {
  const chatPath = getPath(state.routeTree.routeState, [chatTab])
  if (chatPath.get(0) !== chatTab) {
    return null
  }
  const selected = chatPath.get(1)
  if (selected === Constants.nothingSelected) {
    return null
  }
  return selected
}

const _selectedInboxSelector = (state: TypedState, conversationIDKey) => {
  return state.chat.get('inbox').find(convo => convo.get('conversationIDKey') === conversationIDKey)
}

const _metaDataSelector = (state: TypedState) => state.chat.get('metaData')
const _routeSelector = (state: TypedState) => state.routeTree.get('routeState').get('selected')
const _focusedSelector = (state: TypedState) => state.chat.get('focused')
const _conversationStateSelector = (state: TypedState, conversationIDKey: ConversationIDKey) => state.chat.get('conversationStates', Map()).get(conversationIDKey)
const _messageSelector = (state: TypedState, conversationIDKey: ConversationIDKey, messageID: MessageID) => _conversationStateSelector(state, conversationIDKey).get('messages').find(m => m.messageID === messageID)
const _messageOutboxIDSelector = (state: TypedState, conversationIDKey: ConversationIDKey, outboxID: OutboxIDKey) => _conversationStateSelector(state, conversationIDKey).get('messages').find(m => m.outboxID === outboxID)
const _pendingFailureSelector = (state: TypedState, outboxID: OutboxIDKey) => state.chat.get('pendingFailures').get(outboxID)
const _devicenameSelector = (state: TypedState) => state.config && state.config.extendedConfig && state.config.extendedConfig.device && state.config.extendedConfig.device.name

function _tmpFileName (isHdPreview: boolean, conversationID: ConversationIDKey, messageID: ?MessageID, filename: string) {
  return `kbchat-${isHdPreview ? 'hdPreview' : 'preview'}-${messageID || ''}-${filename}`
}

function updateBadging (conversationIDKey: ConversationIDKey): UpdateBadging {
  return {type: 'chat:updateBadging', payload: {conversationIDKey}}
}

function updateLatestMessage (conversationIDKey: ConversationIDKey): UpdateLatestMessage {
  return {type: 'chat:updateLatestMessage', payload: {conversationIDKey}}
}

function badgeAppForChat (conversations: List<ConversationBadgeState>): BadgeAppForChat {
  return {type: 'chat:badgeAppForChat', payload: conversations}
}

function openFolder (): OpenFolder {
  return {type: 'chat:openFolder', payload: undefined}
}

function startConversation (users: Array<string>): StartConversation {
  return {type: 'chat:startConversation', payload: {users}}
}

function newChat (existingParticipants: Array<string>): NewChat {
  return {type: 'chat:newChat', payload: {existingParticipants}}
}

function postMessage (conversationIDKey: ConversationIDKey, text: HiddenString): PostMessage {
  return {type: 'chat:postMessage', payload: {conversationIDKey, text}, logTransformer: postMessageActionTransformer}
}

function setupChatHandlers (): SetupChatHandlers {
  return {type: 'chat:setupChatHandlers', payload: undefined}
}

function retryMessage (conversationIDKey: ConversationIDKey, outboxIDKey: string): RetryMessage {
  return {type: 'chat:retryMessage', payload: {conversationIDKey, outboxIDKey}, logTransformer: retryMessageActionTransformer}
}

function loadInbox (newConversationIDKey: ?ConversationIDKey): LoadInbox {
  return {payload: {newConversationIDKey}, type: 'chat:loadInbox'}
}

function loadMoreMessages (conversationIDKey: ConversationIDKey, onlyIfUnloaded: boolean): LoadMoreMessages {
  return {type: 'chat:loadMoreMessages', payload: {conversationIDKey, onlyIfUnloaded}}
}

function editMessage (message: Message): EditMessage {
  return {type: 'chat:editMessage', payload: {message}}
}

function deleteMessage (message: Message): DeleteMessage {
  return {type: 'chat:deleteMessage', payload: {message}}
}

function retryAttachment (message: Constants.AttachmentMessage): Constants.SelectAttachment {
  const {conversationIDKey, filename, title, previewType, outboxID} = message
  return {type: 'chat:selectAttachment', payload: {conversationIDKey, filename, title, type: previewType || 'Other', outboxID}}
}

function selectAttachment (conversationIDKey: ConversationIDKey, filename: string, title: string, type: Constants.AttachmentType): Constants.SelectAttachment {
  return {type: 'chat:selectAttachment', payload: {conversationIDKey, filename, title, type}}
}

function loadAttachment (conversationIDKey: ConversationIDKey, messageID: Constants.MessageID, loadPreview: boolean, isHdPreview: boolean, filename: string): Constants.LoadAttachment {
  return {type: 'chat:loadAttachment', payload: {conversationIDKey, messageID, loadPreview, isHdPreview, filename}}
}

// Select conversation, fromUser indicates it was triggered by a user and not programatically
function selectConversation (conversationIDKey: ConversationIDKey, fromUser: boolean): SelectConversation {
  return {type: 'chat:selectConversation', payload: {conversationIDKey, fromUser}}
}

function _inboxConversationToConversation (convo: ConversationLocal, author: ?string, following: {[key: string]: boolean}, metaData: MetaData): ?InboxState {
  if (!convo || !convo.info || !convo.info.id) {
    return null
  }

  // We don't support mixed reader/writers
  if (convo.info.tlfName.includes('#')) {
    return null
  }

  const conversationIDKey = conversationIDToKey(convo.info.id)
  let snippet

  (convo.maxMessages || []).some(message => {
    if (message.state === LocalMessageUnboxedState.valid && message.valid) {
      snippet = makeSnippet(message.valid.messageBody)
      return !!snippet
    }
    return false
  })

  const participants = List(convo.info.writerNames || [])
  return new InboxStateRecord({
    info: convo.info,
    isEmpty: convo.isEmpty,
    conversationIDKey,
    participants,
    muted: false,
    time: convo.readerInfo.mtime,
    snippet,
    validated: true,
  })
}

function _inboxToConversations (inbox: GetInboxLocalRes, author: ?string, following: {[key: string]: boolean}, metaData: MetaData): List<InboxState> {
  return List((inbox.conversationsUnverified || []).map(convoUnverified => {
    const msgBoxed = convoUnverified.maxMsgs && convoUnverified.maxMsgs.length && convoUnverified.maxMsgs[0]

    if (!msgBoxed) {
      return null
    }

    const participants = List(parseFolderNameToUsers(author, msgBoxed.clientHeader.tlfName).map(ul => ul.username))

    return new InboxStateRecord({
      info: null,
      conversationIDKey: conversationIDToKey(convoUnverified.metadata.conversationID),
      participants,
      muted: false, // TODO integrate this when it's available
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

  yield put(({
    payload: {
      conversationIDKey,
      message: {
        messageState: 'pending',
      },
      outboxID: outboxIDKey,
    },
    type: 'chat:updateTempMessage',
  }: Constants.UpdateTempMessage))

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

function * _postMessage (action: PostMessage): SagaGenerator<any, any> {
  const {conversationIDKey} = action.payload
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
      type: 'Text',
      author,
      outboxID,
      key: outboxID,
      timestamp: Date.now(),
      messageState: hasPendingFailure ? 'failed' : 'pending',
      message: new HiddenString(action.payload.text.stringValue()),
      you: author,
      deviceType: isMobile ? 'mobile' : 'desktop',
      deviceName: '',
      conversationIDKey: action.payload.conversationIDKey,
      senderDeviceRevokedAt: null,
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
    const selectedConversation = yield select(_selectedSelector)
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
    // TODO: Use delete message RPC call when it is available
    const clientHeader = yield call(_clientHeader, CommonMessageType.delete, conversationIDKey)
    clientHeader.supersedes = messageID

    yield call(localPostLocalNonblockRpcPromise, {
      param: {
        conversationID: keyToConversationID(conversationIDKey),
        identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
        msg: {
          clientHeader,
        },
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

function * _incomingMessage (action: IncomingMessage): SagaGenerator<any, any> {
  switch (action.payload.activity.activityType) {
    case NotifyChatChatActivityType.failedMessage:
      const failedMessage: ?FailedMessageInfo = action.payload.activity.failedMessage
      if (failedMessage && failedMessage.outboxRecords) {
        for (const outboxRecord of failedMessage.outboxRecords) {
          const conversationIDKey = conversationIDToKey(outboxRecord.convID)
          const outboxID = outboxIDToKey(outboxRecord.outboxID)

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
            yield put(({
              payload: {
                conversationIDKey,
                message: {
                  ...pendingMessage,
                  messageState: 'failed',
                },
                outboxID,
              },
              type: 'chat:updateTempMessage',
            }: Constants.UpdateTempMessage))
          } else {
            yield put(({
              payload: {
                outboxID,
              },
              type: 'chat:createPendingFailure',
            }: CreatePendingFailure))
          }
        }
      }
      return
    case NotifyChatChatActivityType.incomingMessage:
      const incomingMessage: ?IncomingMessageRPCType = action.payload.activity.incomingMessage
      if (incomingMessage) {
        const messageUnboxed: MessageUnboxed = incomingMessage.message
        const yourName = yield select(usernameSelector)
        const yourDeviceName = yield select(_devicenameSelector)
        const conversationIDKey = conversationIDToKey(incomingMessage.convID)
        const message = _unboxedToMessage(messageUnboxed, 0, yourName, yourDeviceName, conversationIDKey)

        // Is this message for the currently selected and focused conversation?
        // And is the Chat tab the currently displayed route? If all that is
        // true, mark it as read ASAP to avoid badging it -- we don't need to
        // badge, the user's looking at it already.  Also mark as read ASAP if
        // it was written by the current user.
        const selectedConversationIDKey = yield select(_selectedSelector)
        const appFocused = yield select(_focusedSelector)
        const selectedTab = yield select(_routeSelector)
        const chatTabSelected = (selectedTab === chatTab)
        const conversationIsFocused = conversationIDKey === selectedConversationIDKey && appFocused && chatTabSelected
        const messageIsYours = (message.type === 'Text' || message.type === 'Attachment') && message.author === yourName

        if (message && message.messageID && (conversationIsFocused || messageIsYours)) {
          yield call(localMarkAsReadLocalRpcPromise, {
            param: {
              conversationID: incomingMessage.convID,
              msgID: message.messageID,
            },
          })
        }

        // TODO short-term if we haven't seen this in the conversation list we'll refresh the inbox. Instead do an integration w/ gregor
        const inboxConvo = yield select(_selectedInboxSelector, conversationIDKey)

        if (!inboxConvo) {
          yield put(loadInbox())
        }

        const conversationState = yield select(_conversationStateSelector, conversationIDKey)
        if (message.type === 'Text' && message.outboxID && message.deviceName === yourDeviceName && yourName === message.author) {
          // If the message has an outboxID and came from our device, then we
          // sent it and have already rendered it in the message list; we just
          // need to mark it as sent.
          yield put(({
            payload: {
              conversationIDKey,
              message: {
                ...message,
                messageState: 'sent',
              },
              outboxID: message.outboxID,
            },
            type: 'chat:updateTempMessage',
          }: Constants.UpdateTempMessage))

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

          yield put({
            logTransformer: appendMessageActionTransformer,
            payload: {
              conversationIDKey,
              isSelected: conversationIDKey === selectedConversationIDKey,
              messages: [message],
            },
            type: 'chat:appendMessages',
          })

          if (message.type === 'Attachment' && !message.previewPath && message.messageID) {
            yield put(loadAttachment(conversationIDKey, message.messageID, true, false, tmpFile(_tmpFileName(false, message.conversationIDKey, message.messageID, message.filename))))
          }
        }
      }
      break
    default:
      console.warn('Unsupported incoming message type for Chat:', action.payload.activity)
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

    engine().setIncomingHandler('chat.1.NotifyChat.ChatInboxStale', () => {
      dispatch({type: 'chat:inboxStale', payload: undefined})
    })

    engine().setIncomingHandler('chat.1.NotifyChat.ChatThreadsStale', ({convIDs}) => {
      dispatch({type: 'chat:markThreadsStale', payload: {convIDKeys: convIDs.map(conversationIDToKey)}})
    })
  })
}

const followingSelector = (state: TypedState) => state.config.following

function * _loadInbox (action: ?LoadInbox): SagaGenerator<any, any> {
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
  yield put({type: 'chat:loadedInbox', payload: {inbox: conversations}, logTransformer: loadedInboxActionTransformer})
  chatInboxUnverified.response.result()

  // +1 for the finish call
  const total = inbox.conversationsUnverified && inbox.conversationsUnverified.length + 1 || 0
  for (let i = 0; i < total; ++i) {
    const incoming: {[key: string]: any} = yield race({
      chatInboxConversation: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxConversation'),
      chatInboxFailed: takeFromChannelMap(loadInboxChanMap, 'chat.1.chatUi.chatInboxFailed'),
      finished: takeFromChannelMap(loadInboxChanMap, 'finished'),
      timeout: call(delay, 5000),
    })

    if (incoming.chatInboxConversation) {
      incoming.chatInboxConversation.response.result()
      let conversation: ?InboxState = _inboxConversationToConversation(incoming.chatInboxConversation.params.conv, author, following || {}, metaData)
      if (conversation && action && action.payload && action.payload.newConversationIDKey) {
        conversation = conversation.set('youCreated', true)
      }
      if (conversation && (!conversation.get('isEmpty') || conversation.get('youCreated'))) {
        yield put({type: 'chat:updateInbox', payload: {conversation}})
      }
      // find it
    } else if (incoming.chatInboxFailed) {
      incoming.chatInboxFailed.response.result()
    } else if (incoming.finished) {
      yield put({type: 'chat:updateInboxComplete', payload: undefined})
      // check valid selected
      const inboxSelector = (state: TypedState, conversationIDKey) => state.chat.get('inbox')
      const inbox = yield select(inboxSelector)
      if (inbox.count()) {
        const conversationIDKey = yield select(_selectedSelector)
        if (!inbox.find(c => c.get('conversationIDKey') === conversationIDKey && c.get('validated'))) {
          yield put(selectConversation(inbox.get(0).get('conversationIDKey'), false))
        }
      }
      break
    } else if (incoming.timeout) {
      console.warn('Inbox loading timed out')
      yield put({type: 'chat:updateInboxComplete', payload: undefined})
      break
    }
  }
}

function * _loadedInbox (action: LoadedInbox): SagaGenerator<any, any> {
  const selectedConversation = yield select(_selectedSelector)

  if (!selectedConversation) {
    if (action.payload.inbox.count()) {
      const mostRecentConversation = action.payload.inbox.get(0)
      yield put(selectConversation(mostRecentConversation.get('conversationIDKey'), false))
    }
  }
}

function * _onUpdateInbox (action: UpdateInbox): SagaGenerator<any, any> {
  const conversationIDKey = yield select(_selectedSelector)
  if (action.payload.conversation.get('conversationIDKey') === conversationIDKey) {
    yield put(loadMoreMessages(conversationIDKey, true))
  }
}

function * _loadMoreMessages (action: LoadMoreMessages): SagaGenerator<any, any> {
  const conversationIDKey = action.payload.conversationIDKey

  if (!conversationIDKey) {
    return
  }

  const conversationID = keyToConversationID(conversationIDKey)
  const inboxConvo = yield select(_selectedInboxSelector, conversationIDKey)
  if (inboxConvo && !inboxConvo.validated) {
    __DEV__ && console.log('Bailing on not yet validated conversation')
    return
  }

  const oldConversationState = yield select(_conversationStateSelector, conversationIDKey)

  let next
  if (oldConversationState) {
    if (action.payload.onlyIfUnloaded && oldConversationState.get('paginationNext')) {
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

  const thread = yield call(localGetThreadLocalRpcPromise, {param: {
    conversationID,
    query: {markAsRead: true},
    pagination: {
      next,
      num: Constants.maxMessagesToLoadAtATime,
    },
    identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
  }})

  const yourName = yield select(usernameSelector)
  const yourDeviceName = yield select(_devicenameSelector)
  const messages = (thread && thread.thread && thread.thread.messages || []).map((message, idx) => _unboxedToMessage(message, idx, yourName, yourDeviceName, conversationIDKey)).reverse()
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

function _maybeAddTimestamp (message: Message, prevMessage: Message): MaybeTimestamp {
  if (prevMessage == null || prevMessage.type === 'Timestamp' || message.type === 'Timestamp' || message.type === 'Deleted' || message.type === 'Unhandled') {
    return null
  }
  // messageID 1 is an unhandled placeholder. We want to add a timestamp before
  // the first message, as well as between any two messages with long duration.
  if (prevMessage.messageID === 1 || message.timestamp - prevMessage.timestamp > Constants.howLongBetweenTimestampsMs) {
    return {
      type: 'Timestamp',
      timestamp: message.timestamp,
      key: message.timestamp,
    }
  }
  return null
}

const _temporaryAttachmentMessageForUpload = (convID: ConversationIDKey, username: string, title: string, filename: string, outboxID: Constants.OutboxIDKey, previewType: $PropertyType<Constants.AttachmentMessage, 'previewType'>) => ({
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
  previewPath: filename,
  downloadedPath: null,
  outboxID,
  progress: 0, /* between 0 - 1 */
  messageState: 'uploading',
  key: `temp-${outboxID}`,
})

function _unboxedToMessage (message: MessageUnboxed, idx: number, yourName, yourDeviceName, conversationIDKey: ConversationIDKey): Message {
  if (message && message.state === LocalMessageUnboxedState.outbox && message.outbox) {
    // Outbox messages are always text, not attachments.
    const payload: OutboxRecord = message.outbox
    const messageState: MessageState = (payload && payload.state && payload.state.state === 1) ? 'failed' : 'pending'
    const messageBody: MessageBody = payload.Msg.messageBody
    // $FlowIssue
    const messageText: MessageText = messageBody.text
    return {
      author: yourName,
      conversationIDKey,
      deviceName: yourDeviceName,
      deviceType: isMobile ? 'mobile' : 'desktop',
      key: payload.outboxID,
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
        you: yourName,
        deviceName: payload.senderDeviceName,
        deviceType: toDeviceType(payload.senderDeviceType),
        timestamp: payload.serverHeader.ctime,
        messageID: payload.serverHeader.messageID,
        conversationIDKey,
        senderDeviceRevokedAt: payload.senderDeviceRevokedAt,
      }

      switch (payload.messageBody.messageType) {
        case CommonMessageType.text:
          const outboxID = payload.clientHeader.outboxID && outboxIDToKey(payload.clientHeader.outboxID)
          return {
            type: 'Text',
            ...common,
            message: new HiddenString(payload.messageBody && payload.messageBody.text && payload.messageBody.text.body || ''),
            messageState: 'sent', // TODO, distinguish sent/pending once CORE sends it.
            outboxID,
            key: common.messageID,
          }
        case CommonMessageType.attachment:
          // $FlowIssue
          const preview: Asset = payload.messageBody.attachment.preview
          const mimeType = preview && preview.mimeType
          const previewSize = preview && preview.metadata && Constants.parseMetadataPreviewSize(preview.metadata)

          return {
            type: 'Attachment',
            ...common,
            // $FlowIssue todo fix
            filename: payload.messageBody.attachment.object.filename,
            // $FlowIssue todo fix
            title: payload.messageBody.attachment.object.title,
            messageState: 'sent',
            previewType: mimeType && mimeType.indexOf('image') === 0 ? 'Image' : 'Other',
            previewPath: null,
            hdPreviewPath: null,
            previewSize,
            downloadedPath: null,
            key: common.messageID,
          }
        case CommonMessageType.delete:
          return {
            type: 'Deleted',
            timestamp: payload.serverHeader.ctime,
            messageID: payload.serverHeader.messageID,
            key: payload.serverHeader.messageID,
            deletedIDs: payload.messageBody.delete && payload.messageBody.delete.messageIDs || [],
          }
        default:
          const unhandled: UnhandledMessage = {
            ...common,
            key: common.messageID,
            type: 'Unhandled',
          }
          return unhandled
      }
    }
  }

  return {
    type: 'Error', // TODO
    messageID: idx,
    key: idx,
    timestamp: Date.now(),
    reason: 'temp',
    conversationIDKey: conversationIDKey,
  }
}

function * _startConversation (action: StartConversation): SagaGenerator<any, any> {
  const result = yield call(localNewConversationLocalRpcPromise, {
    param: {
      tlfName: action.payload.users.join(','),
      topicType: CommonTopicType.chat,
      tlfVisibility: CommonTLFVisibility.private,
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
    }})
  if (result) {
    const conversationIDKey = conversationIDToKey(result.conv.info.id)

    yield put(loadInbox(conversationIDKey))
    yield put(selectConversation(conversationIDKey, false))
    yield put(switchTo([chatTab]))
  }
}

function * _openFolder (): SagaGenerator<any, any> {
  const conversationIDKey = yield select(_selectedSelector)

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
  yield put(loadMoreMessages(conversationIDKey, true))
  yield put(navigateTo([conversationIDKey], [chatTab]))

  const inbox = yield select(_selectedInboxSelector, conversationIDKey)
  if (inbox) {
    yield put({type: 'chat:updateMetadata', payload: {users: inbox.get('participants').toArray()}})
  }

  if (inbox && !inbox.get('validated')) {
    return
  }

  if (fromUser) {
    yield put(updateBadging(conversationIDKey))
    yield put(updateLatestMessage(conversationIDKey))
  }
}

function * _updateBadging (action: UpdateBadging): SagaGenerator<any, any> {
  // Update gregor's view of the latest message we've read.
  const {conversationIDKey} = action.payload
  const conversationState = yield select(_conversationStateSelector, conversationIDKey)
  if (conversationState && conversationState.firstNewMessageID && conversationState.messages !== null && conversationState.messages.size > 0) {
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
  const conversationIDKey = yield select(_selectedSelector)
  const selectedTab = yield select(_routeSelector)
  const chatTabSelected = (selectedTab === chatTab)

  if (conversationIDKey && appFocused && chatTabSelected) {
    yield put(updateBadging(conversationIDKey))
    yield put(updateLatestMessage(conversationIDKey))
  }
}

function * _badgeAppForChat (action: BadgeAppForChat): SagaGenerator<any, any> {
  const conversations = action.payload
  const selectedConversationIDKey = yield select(_selectedSelector)
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

function * _uploadAttachment ({param, conversationIDKey, outboxID}: {param: ChatTypes.localPostFileAttachmentLocalRpcParam, conversationIDKey: ConversationIDKey, outboxID: Constants.OutboxIDKey}) {
  const channelConfig = singleFixedChannelConfig([
    'chat.1.chatUi.chatAttachmentUploadStart',
    'chat.1.chatUi.chatAttachmentPreviewUploadStart',
    'chat.1.chatUi.chatAttachmentUploadProgress',
    'chat.1.chatUi.chatAttachmentUploadDone',
    'chat.1.chatUi.chatAttachmentPreviewUploadDone',
    'finished',
  ])

  const channelMap = ((yield call(localPostFileAttachmentLocalRpcChannelMap, channelConfig, {param})): any)

  const finishedTask = yield fork(function * () {
    const finished = yield takeFromChannelMap(channelMap, 'finished')
    if (finished.error) {
      console.warn('error here!!')
      throw new Error('Error in uploading attachment ' + finished.error)
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

  const uploadStart = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadStart')
  uploadStart.response.result()

  const previewTask = yield fork(function * () {
    const previewUploadStart = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentPreviewUploadStart')
    previewUploadStart.response.result()

    const metadata = previewUploadStart.params && previewUploadStart.params.metadata
    const previewSize = metadata && Constants.parseMetadataPreviewSize(metadata)
    if (previewSize) {
      yield put(({
        type: 'chat:updateTempMessage',
        payload: {
          conversationIDKey,
          outboxID,
          message: {previewSize},
        },
      }: Constants.UpdateTempMessage))
    }

    const previewUploadDone = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentPreviewUploadDone')
    previewUploadDone.response.result()
  })

  const uploadDone = yield takeFromChannelMap(channelMap, 'chat.1.chatUi.chatAttachmentUploadDone')
  uploadDone.response.result()

  const finished = yield join(finishedTask)
  const {params: {messageID}} = finished
  yield cancel(progressTask)
  yield cancel(previewTask)
  closeChannelMap(channelMap)

  return messageID
}

function * _selectAttachment ({payload: {conversationIDKey, filename, title, type, outboxID = (Math.ceil(Math.random() * 1e9) + '')}}: Constants.SelectAttachment): SagaGenerator<any, any> {
  const clientHeader = yield call(_clientHeader, CommonMessageType.attachment, conversationIDKey)
  const attachment = {
    filename,
  }

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

  const param = {
    conversationID: keyToConversationID(conversationIDKey),
    clientHeader,
    attachment,
    title,
    metadata: null,
    identifyBehavior: yield call(_getPostingIdentifyBehavior, conversationIDKey),
  }

  try {
    const messageID = yield call(_uploadAttachment, {param, conversationIDKey, outboxID})
    yield put(({
      type: 'chat:updateTempMessage',
      payload: {
        conversationIDKey,
        outboxID,
        message: {type: 'Attachment', messageState: 'sent', messageID, key: messageID},
      },
    }: Constants.UpdateTempMessage))

    yield put(({
      type: 'chat:markSeenMessage',
      payload: {
        conversationIDKey,
        messageID: messageID,
      },
    }: Constants.MarkSeenMessage))
  } catch (e) {
    yield put(({
      type: 'chat:updateTempMessage',
      error: true,
      payload: {
        conversationIDKey,
        outboxID,
        error: e,
      },
    }: Constants.UpdateTempMessage))
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
    if (exists(filename)) {
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
      payload: {conversationIDKey, messageID, bytesTotal, bytesComplete},
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

  // Only send if you're not looking at it
  if (!action.isSelected || !appFocused || !chatTabSelected) {
    const me = yield select(usernameSelector)
    const message = (action.payload.messages.reverse().find(m => m.type === 'Text' && m.author !== me))
    if (message && message.type === 'Text') {
      const snippet = makeSnippet(serverMessageToMessageBody(message))

      yield put((dispatch: Dispatch) => {
        NotifyPopup(message.author, {body: snippet}, -1, () => {
          dispatch(selectConversation(action.payload.conversationIDKey, false))
          dispatch(switchTo([chatTab]))
          dispatch(showMainWindow())
        })
      })
    }
  }
}

function * _markThreadsStale (action: MarkThreadsStale): SagaGenerator<any, any> {
  const selectedConversation = yield select(_selectedSelector)
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
  if (!message.hdPreviewPath) {
    yield put(loadAttachment(message.conversationIDKey, messageID, false, true, tmpFile(_tmpFileName(true, message.conversationIDKey, message.messageID, message.filename))))
  }
}

function _threadIsCleared (originalAction: Action, checkAction: Action): boolean {
  return originalAction.type === 'chat:loadMoreMessages' && checkAction.type === 'chat:clearMessages' && originalAction.conversationIDKey === checkAction.conversationIDKey
}

function * chatSaga (): SagaGenerator<any, any> {
  yield [
    safeTakeSerially('chat:loadInbox', _loadInbox),
    safeTakeLatest('chat:inboxStale', _loadInbox),
    safeTakeLatest('chat:loadedInbox', _loadedInbox),
    safeTakeEvery('chat:loadMoreMessages', cancelWhen(_threadIsCleared, _loadMoreMessages)),
    safeTakeLatest('chat:selectConversation', _selectConversation),
    safeTakeEvery('chat:updateBadging', _updateBadging),
    safeTakeEvery('chat:setupChatHandlers', _setupChatHandlers),
    safeTakeEvery('chat:incomingMessage', _incomingMessage),
    safeTakeEvery('chat:markThreadsStale', _markThreadsStale),
    safeTakeEvery('chat:newChat', _newChat),
    safeTakeEvery('chat:postMessage', _postMessage),
    safeTakeEvery('chat:retryMessage', _retryMessage),
    safeTakeEvery('chat:startConversation', _startConversation),
    safeTakeEvery('chat:updateMetadata', _updateMetadata),
    safeTakeEvery('chat:appendMessages', _sendNotifications),
    safeTakeEvery('chat:selectAttachment', _selectAttachment),
    safeTakeEvery('chat:loadAttachment', _loadAttachment),
    safeTakeEvery('chat:openAttachmentPopup', _openAttachmentPopup),
    safeTakeLatest('chat:openFolder', _openFolder),
    safeTakeLatest('chat:badgeAppForChat', _badgeAppForChat),
    safeTakeLatest('chat:updateInbox', _onUpdateInbox),
    safeTakeEvery(changedFocus, _changedFocus),
    safeTakeEvery('chat:deleteMessage', _deleteMessage),
  ]
}

export default chatSaga

export {
  badgeAppForChat,
  deleteMessage,
  editMessage,
  loadAttachment,
  loadInbox,
  loadMoreMessages,
  newChat,
  selectAttachment,
  openFolder,
  postMessage,
  retryAttachment,
  retryMessage,
  selectConversation,
  setupChatHandlers,
  startConversation,
}
