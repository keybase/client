// @flow
import * as Constants from '../constants/chat'
import HiddenString from '../util/hidden-string'
import engine from '../engine'
import {CommonMessageType, CommonTLFVisibility, LocalMessageUnboxedState, NotifyChatChatActivityType, localGetInboxAndUnboxLocalRpcPromise, localGetThreadLocalRpcPromise, localMarkAsReadLocalRpcPromise, localPostLocalNonblockRpcPromise, localNewConversationLocalRpcPromise, CommonTopicType, CommonConversationStatus} from '../constants/types/flow-types-chat'
import {List, Map} from 'immutable'
import {apiserverGetRpcPromise, TlfKeysTLFIdentifyBehavior} from '../constants/types/flow-types'
import {badgeApp} from './notifications'
import {call, put, select} from 'redux-saga/effects'
import {searchTab, chatTab} from '../constants/tabs'
import {openInKBFS} from './kbfs'
import {publicFolderWithUsers, privateFolderWithUsers} from '../constants/config'
import {safeTakeEvery, safeTakeLatest} from '../util/saga'
import {reset as searchReset, addUsersToGroup as searchAddUsersToGroup} from './search'
import {switchTo} from './route-tree'
import {usernameSelector} from '../constants/selectors'

import type {GetInboxAndUnboxLocalRes, IncomingMessage as IncomingMessageRPCType, MessageUnboxed} from '../constants/types/flow-types-chat'
import type {SagaGenerator} from '../constants/types/saga'
import type {TypedState} from '../constants/reducer'
import type {
  ConversationIDKey,
  DeleteMessage,
  EditMessage,
  InboxState,
  IncomingMessage,
  LoadInbox,
  LoadMoreMessages,
  LoadedInbox,
  MaybeTimestamp,
  Message,
  NewChat,
  OpenFolder,
  PostMessage,
  SelectConversation,
  SetupNewChatHandler,
  StartConversation,
  UnhandledMessage,
  UpdateMetadata,
} from '../constants/chat'

const {conversationIDToKey, keyToConversationID, InboxStateRecord, makeSnippet, MetaDataRecord} = Constants

function openFolder (): OpenFolder {
  return {type: Constants.openFolder, payload: undefined}
}

function startConversation (users: Array<string>): StartConversation {
  return {type: Constants.startConversation, payload: {users}}
}

function newChat (existingParticipants: Array<string>): NewChat {
  return {type: Constants.newChat, payload: {existingParticipants}}
}

function postMessage (conversationIDKey: ConversationIDKey, text: HiddenString): PostMessage {
  return {type: Constants.postMessage, payload: {conversationIDKey, text}}
}

function setupNewChatHandler (): SetupNewChatHandler {
  return {type: Constants.setupNewChatHandler, payload: undefined}
}

function loadInbox (): LoadInbox {
  return {type: Constants.loadInbox, payload: undefined}
}

function loadMoreMessages (): LoadMoreMessages {
  return {type: Constants.loadMoreMessages, payload: undefined}
}

function editMessage (message: Message): EditMessage {
  return {type: Constants.editMessage, payload: {message}}
}

function deleteMessage (message: Message): DeleteMessage {
  return {type: Constants.deleteMessage, payload: {message}}
}

// Select conversation, fromUser indicates it was triggered by a user and not programatically
function selectConversation (conversationIDKey: ConversationIDKey, fromUser: boolean): SelectConversation {
  return {type: Constants.selectConversation, payload: {conversationIDKey, fromUser}}
}

function _inboxToConversations (inbox: GetInboxAndUnboxLocalRes, author: ?string, following: {[key: string]: boolean}): List<InboxState> {
  return List((inbox.conversations || []).map(convo => {
    if (!convo.info.id) {
      return null
    }

    let snippet
    (convo.maxMessages || []).some(message => {
      if (message.state === LocalMessageUnboxedState.valid && message.valid) {
        switch (message.valid.messageBody.messageType) {
          case CommonMessageType.text:
            snippet = makeSnippet(message.valid.messageBody.text && message.valid.messageBody.text.body, 100)
            return true
          case CommonMessageType.attachment:
            snippet = 'Attachment'
            return true
          default:
            return false
        }
      }
      return false
    })

    // TODO in recent order... somehow
    const participants = List((convo.info.writerNames || []).map(username => ({
      username,
      broken: false, // TODO
      you: author && username === author,
      following: !!following[username],
    })))

    return new InboxStateRecord({
      info: convo.info,
      conversationIDKey: conversationIDToKey(convo.info.id),
      participants,
      muted: false, // TODO integrate this when it's available
      time: convo.readerInfo.mtime,
      snippet,
      unreadCount: convo.readerInfo.maxMsgid - convo.readerInfo.readMsgid, // TODO likely get this from the notifications payload miles is working on
    })
  }).filter(Boolean))
}

function * _postMessage (action: PostMessage): SagaGenerator<any, any> {
  const {conversationIDKey} = action.payload
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

  const clientHeader = {
    conv: info.triple,
    tlfName: info.tlfName,
    tlfPublic: info.visibility === CommonTLFVisibility.public,
    messageType: CommonMessageType.text,
    supersedes: 0,
    sender: Buffer.from(uid, 'hex'),
    senderDevice: Buffer.from(deviceID, 'hex'),
  }

  const sent = yield call(localPostLocalNonblockRpcPromise, {
    param: {
      conversationID: keyToConversationID(conversationIDKey),
      identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
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
    const message: Message = {
      type: 'Text',
      author,
      outboxID: sent.outboxID.toString('hex'),
      timestamp: Date.now(),
      messageState: 'pending',
      message: new HiddenString(action.payload.text.stringValue()),
      followState: 'You',
      deviceType: '',
      deviceName: '',
      conversationIDKey: action.payload.conversationIDKey,
    }

    // Time to decide: should we add a timestamp before our new message?
    const conversationStateSelector = (state: TypedState) => state.chat.get('conversationStates', Map()).get(conversationIDKey)
    const conversationState = yield select(conversationStateSelector)
    let messages = []
    if (conversationState && conversationState.messages !== null) {
      const prevMessage = conversationState.messages.get(conversationState.messages.size - 1)
      const timestamp = _maybeAddTimestamp(message, prevMessage)
      if (timestamp !== null) {
        messages.push(timestamp)
      }
    }

    messages.push(message)
    yield put({
      type: Constants.appendMessages,
      payload: {
        conversationIDKey,
        messages,
      },
    })
  }
}

function * _incomingMessage (action: IncomingMessage): SagaGenerator<any, any> {
  switch (action.payload.activity.activityType) {
    case NotifyChatChatActivityType.incomingMessage:
      const incomingMessage: ?IncomingMessageRPCType = action.payload.activity.incomingMessage
      if (incomingMessage) {
        const messageUnboxed: MessageUnboxed = incomingMessage.message
        const yourName = yield select(usernameSelector)
        const conversationIDKey = conversationIDToKey(incomingMessage.convID)
        const message = _unboxedToMessage(messageUnboxed, 0, yourName, conversationIDKey)

        // Is this message for the currently selected conversation? If so, mark
        // it as read ASAP to avoid badging it -- we don't need to badge, the
        // user's looking at it already.
        const selectedSelector = (state: TypedState) => state.chat.get('selectedConversation')
        const selectedConversationIDKey = yield select(selectedSelector)
        if (message && message.messageID && conversationIDKey === selectedConversationIDKey) {
          yield call(localMarkAsReadLocalRpcPromise, {
            param: {
              conversationID: incomingMessage.convID,
              msgID: message.messageID,
            },
          })
        }

        // TODO short-term if we haven't seen this in the conversation list we'll refresh the inbox. Instead do an integration w/ gregor
        const conversationStateSelector = (state: TypedState) => state.chat.get('conversationStates', Map()).get(conversationIDKey)
        const conversationState = yield select(conversationStateSelector)
        if (!conversationState) {
          yield put(loadInbox())
        }

        if (message.outboxID && message.type === 'Text' && yourName === message.author) {
          // If the message has an outboxID, then we sent it and have already
          // rendered it in the message list; we just need to mark it as sent.
          yield put({
            type: Constants.pendingMessageWasSent,
            payload: {
              conversationIDKey,
              outboxID: message.outboxID,
              messageID: message.messageID,
              messageState: 'sent',
            },
          })
        } else {
          // How long was it between the previous message and this one?
          if (conversationState && conversationState.messages !== null) {
            const prevMessage = conversationState.messages.get(conversationState.messages.size - 1)
            const timestamp = _maybeAddTimestamp(message, prevMessage)
            if (timestamp !== null) {
              yield put({
                type: Constants.appendMessages,
                payload: {
                  conversationIDKey,
                  messages: [timestamp],
                },
              })
            }
          }
          yield put({
            type: Constants.appendMessages,
            payload: {
              conversationIDKey,
              messages: [message],
            },
          })
        }
      }
      break
    default:
      console.warn('Unsupported incoming message type for Chat:', action.payload.activity)
  }
}

function * _setupNewChatHandler (): SagaGenerator<any, any> {
  yield put((dispatch: Dispatch) => {
    engine().setIncomingHandler('chat.1.NotifyChat.NewChatActivity', ({uid, activity}) => {
      dispatch({type: Constants.incomingMessage, payload: {activity}})
    })
  })
}

const followingSelector = (state: TypedState) => state.config.following

function * _loadInbox (): SagaGenerator<any, any> {
  const inbox: GetInboxAndUnboxLocalRes = ((yield call(localGetInboxAndUnboxLocalRpcPromise, {param: {
    query: {
      status: Object.keys(CommonConversationStatus).filter(k => !['ignored', 'blocked'].includes(k)).map(k => CommonConversationStatus[k]),
    },
    identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
  }})): any)
  const author = yield select(usernameSelector)

  const following = yield select(followingSelector)

  const conversations: List<InboxState> = _inboxToConversations(inbox, author, following || {})
  yield put({type: Constants.loadedInbox, payload: {inbox: conversations}})
}

function * _loadedInbox (action: LoadedInbox): SagaGenerator<any, any> {
  const selector = (state: TypedState) => state.chat.get('selectedConversation')
  const selectedConversation = yield select(selector)

  if (!selectedConversation) {
    if (action.payload.inbox.count()) {
      const mostRecentConversation = action.payload.inbox.get(0)
      yield put(selectConversation(mostRecentConversation.get('conversationIDKey'), false))
    }
  }
}

function * _loadMoreMessages (): SagaGenerator<any, any> {
  const selectedSelector = (state: TypedState) => state.chat.get('selectedConversation')
  const conversationIDKey = yield select(selectedSelector)

  if (!conversationIDKey) {
    return
  }

  const conversationID = keyToConversationID(conversationIDKey)
  const conversationStateSelector = (state: TypedState) => state.chat.get('conversationStates', Map()).get(conversationIDKey)
  const oldConversationState = yield select(conversationStateSelector)

  let next
  if (oldConversationState) {
    if (oldConversationState.get('isLoading')) {
      __DEV__ && console.log('Bailing on chat load more due to isloading already')
      return
    }

    if (!oldConversationState.get('moreToLoad')) {
      __DEV__ && console.log('Bailing on chat load more due to no more to load')
      return
    }

    next = oldConversationState.get('paginationNext', undefined)
  }

  yield put({type: Constants.loadingMessages, payload: {conversationIDKey}})

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
  const messages = (thread && thread.thread && thread.thread.messages || []).map((message, idx) => _unboxedToMessage(message, idx, yourName, conversationIDKey)).reverse()
  let newMessages = []
  messages.forEach((message, idx) => {
    if (idx >= 2) {
      const timestamp = _maybeAddTimestamp(messages[idx], messages[idx - 1])
      if (timestamp !== null) {
        newMessages.push(timestamp)
      }
    }
    newMessages.push(message)
  })

  const pagination = _threadToPagination(thread)

  yield put({
    type: Constants.prependMessages,
    payload: {
      conversationIDKey,
      messages: newMessages,
      moreToLoad: !pagination.last,
      paginationNext: pagination.next,
    },
  })
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
  if (prevMessage.type === 'Timestamp' || message.type === 'Timestamp') {
    return null
  }
  if (message.timestamp - prevMessage.timestamp > Constants.howLongBetweenTimestampsMs) { // ms
    return {
      type: 'Timestamp',
      timestamp: message.timestamp,
    }
  }
  return null
}

function _unboxedToMessage (message: MessageUnboxed, idx: number, yourName, conversationIDKey: ConversationIDKey): Message {
  if (message.state === LocalMessageUnboxedState.valid) {
    const payload = message.valid
    if (payload) {
      const common = {
        author: payload.senderUsername,
        deviceName: payload.senderDeviceName,
        deviceType: payload.senderDeviceType,
        timestamp: payload.serverHeader.ctime,
        messageID: payload.serverHeader.messageID,
        conversationIDKey: conversationIDKey,
      }

      const isYou = common.author === yourName

      switch (payload.messageBody.messageType) {
        case CommonMessageType.text:
          return {
            type: 'Text',
            ...common,
            message: new HiddenString(payload.messageBody && payload.messageBody.text && payload.messageBody.text.body || ''),
            followState: isYou ? 'You' : 'Following', // TODO get this
            messageState: 'sent', // TODO, distinguish sent/pending once CORE sends it.
            outboxID: payload.clientHeader.outboxID && payload.clientHeader.outboxID.toString('hex'),
          }
        default:
          const unhandled: UnhandledMessage = {
            ...common,
            type: 'Unhandled',
          }
          return unhandled
      }
    }
  }
  return {
    type: 'Error', // TODO
    messageID: idx,
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

    yield put(loadInbox())
    yield put(selectConversation(conversationIDKey, false))
    yield put(switchTo([chatTab]))
  }
}

function * _openFolder (): SagaGenerator<any, any> {
  const selectedSelector = (state: TypedState) => state.chat.get('selectedConversation')
  const conversationIDKey = yield select(selectedSelector)

  const inboxSelector = (state: TypedState) => {
    return state.chat.get('inbox').find(convo => convo.get('conversationIDKey') === conversationIDKey)
  }

  const inbox = yield select(inboxSelector)
  if (inbox) {
    const helper = inbox.get('info').visibility === CommonTLFVisibility.public ? publicFolderWithUsers : privateFolderWithUsers
    const path = helper(inbox.get('participants').map(p => p.username).toArray())
    yield put(openInKBFS(path))
  } else {
    throw new Error(`Can't find conversation path`)
  }
}

function * _newChat (action: NewChat): SagaGenerator<any, any> {
  yield put(searchReset())

  const metaDataSelector = (state: TypedState) => state.chat.get('metaData')
  const metaData = ((yield select(metaDataSelector)): any)

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
  const usernames = action.payload.users.filter(name => name.indexOf('@') === -1).join(',')
  if (!usernames) {
    return
  }
  const results: any = yield call(apiserverGetRpcPromise, {
    param: {
      endpoint: 'user/lookup',
      args: [
        {key: 'usernames', value: usernames},
        {key: 'fields', value: 'profile'},
      ],
    },
  })

  const parsed = JSON.parse(results.body)
  const payload = {}
  action.payload.users.forEach((username, idx) => {
    const record = parsed.them[idx]
    const fullname = (record && record.profile && record.profile.full_name) || ''
    payload[username] = new MetaDataRecord({fullname})
  })

  yield put({
    type: Constants.updatedMetadata,
    payload,
  })
}

function * _selectConversation (action: SelectConversation): SagaGenerator<any, any> {
  yield put(loadMoreMessages())

  const inboxSelector = (state: TypedState) => {
    return state.chat.get('inbox').find(convo => convo.get('conversationIDKey') === action.payload.conversationIDKey)
  }

  const inbox = yield select(inboxSelector)
  if (inbox) {
    yield put({type: Constants.updateMetadata, payload: {users: inbox.get('participants').filter(p => !p.you).map(p => p.username).toArray()}})
    // If we're switching to a badged conversation, unbadge it.
    const conversationStateSelector = (state: TypedState) => state.chat.get('conversationStates', Map()).get(action.payload.conversationIDKey)
    const conversationState = yield select(conversationStateSelector)
    if (conversationState && conversationState.messages !== null) {
      const conversationID = keyToConversationID(action.payload.conversationIDKey)
      const msgID = conversationState.messages.get(conversationState.messages.size - 1).messageID
      yield call(localMarkAsReadLocalRpcPromise, {
        param: {conversationID, msgID},
      })
    }
  }
}

function * chatSaga (): SagaGenerator<any, any> {
  yield [
    safeTakeLatest(Constants.loadInbox, _loadInbox),
    safeTakeLatest(Constants.loadedInbox, _loadedInbox),
    safeTakeEvery(Constants.loadMoreMessages, _loadMoreMessages),
    safeTakeLatest(Constants.selectConversation, _selectConversation),
    safeTakeEvery(Constants.setupNewChatHandler, _setupNewChatHandler),
    safeTakeEvery(Constants.incomingMessage, _incomingMessage),
    safeTakeEvery(Constants.newChat, _newChat),
    safeTakeEvery(Constants.postMessage, _postMessage),
    safeTakeEvery(Constants.startConversation, _startConversation),
    safeTakeEvery(Constants.updateMetadata, _updateMetadata),
    safeTakeLatest(Constants.openFolder, _openFolder),
  ]
}

export default chatSaga

export {
  deleteMessage,
  editMessage,
  loadInbox,
  loadMoreMessages,
  newChat,
  openFolder,
  postMessage,
  selectConversation,
  setupNewChatHandler,
  startConversation,
}
