// @flow
import * as Attachment from './attachment'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as Inbox from './inbox'
import * as Messages from './messages'
import * as Shared from './shared'
import * as Saga from '../../util/saga'
import HiddenString from '../../util/hidden-string'
import engine from '../../engine'
import {Map} from 'immutable'
import {NotifyPopup} from '../../native/notifications'
import {apiserverGetRpcPromise, TlfKeysTLFIdentifyBehavior, ConstantsStatusCode} from '../../constants/types/flow-types'
import {call, put, take, select, race} from 'redux-saga/effects'
import {delay} from 'redux-saga'
import {isMobile} from '../../constants/platform'
import {navigateTo, switchTo} from '../route-tree'
import {openInKBFS} from '../kbfs'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {publicFolderWithUsers, privateFolderWithUsers} from '../../constants/config'
import {reset as searchReset, addUsersToGroup as searchAddUsersToGroup} from '../search'
import {searchTab, chatTab} from '../../constants/tabs'
import {showMainWindow} from '../platform-specific'
import {some} from 'lodash'
import {toDeviceType} from '../../constants/types/more'
import {usernameSelector} from '../../constants/selectors'

import type {Action} from '../../constants/types/flux'
import type {ChangedFocus} from '../../constants/app'
import type {TLFIdentifyBehavior} from '../../constants/types/flow-types'
import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'

function * _incomingMessage (action: Constants.IncomingMessage): SagaGenerator<any, any> {
  switch (action.payload.activity.activityType) {
    case ChatTypes.NotifyChatChatActivityType.setStatus:
      const setStatus: ?ChatTypes.SetStatusInfo = action.payload.activity.setStatus
      if (setStatus) {
        yield call(Inbox.processConversation, setStatus.conv)
        yield call(_ensureValidSelectedChat, false, true)
      }
      return
    case ChatTypes.NotifyChatChatActivityType.failedMessage:
      const failedMessage: ?ChatTypes.FailedMessageInfo = action.payload.activity.failedMessage
      if (failedMessage && failedMessage.outboxRecords) {
        for (const outboxRecord of failedMessage.outboxRecords) {
          const conversationIDKey = Constants.conversationIDToKey(outboxRecord.convID)
          const outboxID = Constants.outboxIDToKey(outboxRecord.outboxID)
          // $FlowIssue
          const errTyp = outboxRecord.state.error.typ
          const failureDescription = _decodeFailureDescription(errTyp)
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
          const isConversationLoaded = yield select(Shared.conversationStateSelector, conversationIDKey)
          if (!isConversationLoaded) return

          const pendingMessage = yield select(Shared.messageOutboxIDSelector, conversationIDKey, outboxID)
          if (pendingMessage) {
            yield put(Creators.updateTempMessage(
              conversationIDKey,
              {
                ...pendingMessage,
                failureDescription,
                messageState: 'failed',
              },
              outboxID
            ))
          } else {
            yield put(Creators.createPendingFailure(failureDescription, outboxID))
          }
        }
      }
      return
    case ChatTypes.NotifyChatChatActivityType.readMessage:
      if (action.payload.activity.readMessage) {
        yield call(Inbox.processConversation, action.payload.activity.readMessage.conv)
      }
      return
    case ChatTypes.NotifyChatChatActivityType.incomingMessage:
      const incomingMessage: ?ChatTypes.IncomingMessage = action.payload.activity.incomingMessage
      if (incomingMessage) {
        // If it's a public chat, the GUI (currently) wants no part of it. We
        // especially don't want to surface the conversation as if it were a
        // private one, which is what we were doing before this change.
        if (incomingMessage.conv && incomingMessage.conv.info && incomingMessage.conv.info.visibility !== ChatTypes.CommonTLFVisibility.private) {
          return
        }

        if (incomingMessage.conv) {
          yield call(Inbox.processConversation, incomingMessage.conv)
        }

        const messageUnboxed: ChatTypes.MessageUnboxed = incomingMessage.message
        const yourName = yield select(usernameSelector)
        const yourDeviceName = yield select(Shared.devicenameSelector)
        const conversationIDKey = Constants.conversationIDToKey(incomingMessage.convID)
        const message = _unboxedToMessage(messageUnboxed, yourName, yourDeviceName, conversationIDKey)

        const pagination = incomingMessage.pagination
        if (pagination) {
          yield put(Creators.updatePaginationNext(conversationIDKey, pagination.next))
        }

        // Is this message for the currently selected and focused conversation?
        // And is the Chat tab the currently displayed route? If all that is
        // true, mark it as read ASAP to avoid badging it -- we don't need to
        // badge, the user's looking at it already.  Also mark as read ASAP if
        // it was written by the current user.
        const selectedConversationIDKey = yield select(Constants.getSelectedConversation)
        const appFocused = yield select(Shared.focusedSelector)
        const selectedTab = yield select(Shared.routeSelector)
        const chatTabSelected = (selectedTab === chatTab)
        const conversationIsFocused = conversationIDKey === selectedConversationIDKey && appFocused && chatTabSelected

        if (message && message.messageID && conversationIsFocused) {
          yield call(ChatTypes.localMarkAsReadLocalRpcPromise, {
            param: {
              conversationID: incomingMessage.convID,
              msgID: message.messageID,
            },
          })
        }

        const messageFromYou = message.deviceName === yourDeviceName && message.author && yourName === message.author

        if (message.type === 'Attachment' && messageFromYou) {
          const outboxID = message.outboxID
          if (outboxID) {  // const + inner if to satisfy flow
            const previewPath = yield select(Shared.attachmentPlaceholderPreviewSelector, outboxID)
            if (previewPath) {
              message.previewPath = previewPath
              yield put(Creators.clearAttachmentPlaceholderPreview(outboxID))
            }
          }
        }

        if (message.type === 'Text' && message.outboxID && messageFromYou) {
          // If the message has an outboxID and came from our device, then we
          // sent it and have already rendered it in the message list; we just
          // need to mark it as sent.
          yield put(Creators.updateTempMessage(
            conversationIDKey,
            {
              ...message,
              messageState: 'sent',
            },
            message.outboxID
          ))

          const messageID = message.messageID
          if (messageID) {
            yield put(Creators.markSeenMessage(conversationIDKey, Constants.messageKey(conversationIDKey, 'messageIDText', messageID)))
          }
        } else {
          yield put(Creators.appendMessages(conversationIDKey, conversationIDKey === selectedConversationIDKey, appFocused, [message]))
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
      dispatch(Creators.incomingMessage(activity))
    })

    engine().setIncomingHandler('chat.1.NotifyChat.ChatIdentifyUpdate', ({update}) => {
      const usernames = update.CanonicalName.split(',')
      const broken = (update.breaks.breaks || []).map(b => b.user.username)
      const userToBroken = usernames.reduce((map, name) => {
        map[name] = !!broken.includes(name)
        return map
      }, {})
      dispatch(Creators.updateBrokenTracker(userToBroken))
    })

    engine().setIncomingHandler('chat.1.NotifyChat.ChatTLFFinalize', ({convID}) => {
      dispatch(Creators.getInboxAndUnbox([Constants.conversationIDToKey(convID)]))
    })

    engine().setIncomingHandler('chat.1.NotifyChat.ChatInboxStale', () => {
      dispatch(Creators.inboxStale(undefined))
    })

    engine().setIncomingHandler('chat.1.NotifyChat.ChatTLFResolve', ({convID, resolveInfo: {newTLFName}}) => {
      dispatch(Creators.inboxStale(undefined))
    })

    engine().setIncomingHandler('chat.1.NotifyChat.ChatThreadsStale', ({convIDs}) => {
      if (convIDs) {
        dispatch(Creators.markThreadsStale(convIDs.map(Constants.conversationIDToKey)))
      }
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
    const conversationIDKey = yield select(Constants.getSelectedConversation)

    if (onlyIfNoSelection && conversationIDKey) {
      return
    }

    const alwaysShow = yield select(Shared.alwaysShowSelector)

    const current = inbox.find(c => c.get('conversationIDKey') === conversationIDKey)
    // current is good
    if (current && (!current.get('isEmpty') || alwaysShow.has(conversationIDKey))) {
      return
    }

    const firstGood = inbox.find(i => !i.get('isEmpty') || alwaysShow.has(i.get('conversationIDKey')))
    if (firstGood && !isMobile) {
      const conversationIDKey = firstGood.get('conversationIDKey')
      yield put(Creators.selectConversation(conversationIDKey, false))
    } else {
      yield put(Creators.selectConversation(null, false))
    }
  }
}

function * _loadMoreMessages (action: Constants.LoadMoreMessages): SagaGenerator<any, any> {
  const conversationIDKey = action.payload.conversationIDKey

  try {
    if (!conversationIDKey) {
      return
    }

    if (Constants.isPendingConversationIDKey(conversationIDKey)) {
      console.log('Bailing on selected pending conversation no matching inbox')
      return
    }

    const inboxConvo = yield select(Shared.selectedInboxSelector, conversationIDKey)

    if (inboxConvo && inboxConvo.state !== 'unboxed') {
      console.log('Bailing on not yet unboxed conversation')
      return
    }

    const rekeyInfoSelector = (state: TypedState, conversationIDKey: Constants.ConversationIDKey) => {
      return state.chat.get('rekeyInfos').get(conversationIDKey)
    }
    const rekeyInfo = yield select(rekeyInfoSelector, conversationIDKey)

    if (rekeyInfo) {
      console.log('Bailing on chat due to rekey info')
      return
    }

    const oldConversationState = yield select(Shared.conversationStateSelector, conversationIDKey)

    let next
    if (oldConversationState) {
      if (action.payload.onlyIfUnloaded && oldConversationState.get('isLoaded')) {
        console.log('Bailing on chat load more due to already has initial load')
        return
      }

      if (oldConversationState.get('isRequesting')) {
        console.log('Bailing on chat load more due to isRequesting already')
        return
      }

      if (!oldConversationState.get('moreToLoad')) {
        console.log('Bailing on chat load more due to no more to load')
        return
      }

      next = oldConversationState.get('paginationNext', undefined)
    }

    yield put(Creators.loadingMessages(conversationIDKey, true))

    const yourName = yield select(usernameSelector)
    const yourDeviceName = yield select(Shared.devicenameSelector)

    // We receive the list with edit/delete/etc already applied so lets filter that out
    const messageTypes = Object.keys(ChatTypes.CommonMessageType).filter(k => !['edit', 'delete', 'headline', 'attachmentuploaded'].includes(k)).map(k => ChatTypes.CommonMessageType[k])
    const conversationID = Constants.keyToConversationID(conversationIDKey)

    const updateThread = function * (thread: ChatTypes.ThreadView) {
      const newMessages = (thread && thread.messages || []).map(message => _unboxedToMessage(message, yourName, yourDeviceName, conversationIDKey)).reverse()
      const pagination = _threadToPagination(thread)
      yield put(Creators.prependMessages(conversationIDKey, newMessages, !pagination.last, pagination.next))
    }

    const loadThreadChanMap = ChatTypes.localGetThreadNonblockRpcChannelMap([
      'chat.1.chatUi.chatThreadCached',
      'chat.1.chatUi.chatThreadFull',
      'finished',
    ], {
      param: {
        conversationID,
        identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
        pagination: {
          last: false,
          next,
          num: Constants.maxMessagesToLoadAtATime,
          previous: null,
        },
        query: {
          disableResolveSupersedes: false,
          markAsRead: true,
          messageTypes,
        },
      },
    })

    while (true) {
      const incoming = yield loadThreadChanMap.race()

      if (incoming.chatThreadCached) {
        incoming.chatThreadCached.response.result()
        yield call(updateThread, incoming.chatThreadCached.params.thread)
      } else if (incoming.chatThreadFull) {
        incoming.chatThreadFull.response.result()
        yield call(updateThread, incoming.chatThreadFull.params.thread)
      } else if (incoming.finished) {
        if (incoming.finished.params.offline) {
          yield put(Creators.threadLoadedOffline(conversationIDKey))
        }
        yield put(Creators.setLoaded(conversationIDKey, !incoming.finished.error)) // reset isLoaded on error
        break
      }
    }

    // Do this here because it's possible loading messages takes a while
    // If this is the selected conversation and this was a result of user action
    // We can assume the messages we've loaded have been seen.
    const selectedConversationIDKey = yield select(Constants.getSelectedConversation)
    if (selectedConversationIDKey === conversationIDKey && action.payload.fromUser) {
      yield put(Creators.updateBadging(conversationIDKey))
      yield put(Creators.updateLatestMessage(conversationIDKey))
    }
  } finally {
    yield put(Creators.loadingMessages(conversationIDKey, false))
  }
}

function _threadToPagination (thread): {last: any, next: any} {
  if (thread && thread.pagination) {
    return thread.pagination
  }
  return {
    last: undefined,
    next: undefined,
  }
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

function _unboxedToMessage (message: ChatTypes.MessageUnboxed, yourName, yourDeviceName, conversationIDKey: Constants.ConversationIDKey): Constants.Message {
  if (message && message.state === ChatTypes.LocalMessageUnboxedState.outbox && message.outbox) {
    // Outbox messages are always text, not attachments.
    const payload: ChatTypes.OutboxRecord = message.outbox
    const messageState: Constants.MessageState = (payload && payload.state && payload.state.state === ChatTypes.LocalOutboxStateType.error) ? 'failed' : 'pending'
    const messageBody: ChatTypes.MessageBody = payload.Msg.messageBody
    const failureDescription = messageState === 'failed'
      // prettier-ignore
      // $FlowIssue
      ? _decodeFailureDescription(payload.state.error.typ)
      : null
    // $FlowIssue
    const messageText: ChatTypes.MessageText = messageBody.text

    return {
      author: yourName,
      conversationIDKey,
      deviceName: yourDeviceName,
      deviceType: isMobile ? 'mobile' : 'desktop',
      editedCount: 0,
      failureDescription,
      key: Constants.messageKey(conversationIDKey, 'outboxIDText', payload.outboxID),
      message: new HiddenString(messageText && messageText.body || ''),
      messageState,
      outboxID: Constants.outboxIDToKey(payload.outboxID),
      senderDeviceRevokedAt: null,
      timestamp: payload.ctime,
      type: 'Text',
      you: yourName,
    }
  }

  if (message.state === ChatTypes.LocalMessageUnboxedState.valid) {
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
        case ChatTypes.CommonMessageType.text:
          const outboxID = payload.clientHeader.outboxID && Constants.outboxIDToKey(payload.clientHeader.outboxID)
          const p: any = payload
          const message = new HiddenString(p.messageBody && p.messageBody.text && p.messageBody.text.body || '')
          // end to del
          return {
            type: 'Text',
            ...common,
            editedCount: payload.serverHeader.supersededBy ? 1 : 0, // mark it as edited if it's been superseded
            message,
            messageState: 'sent', // TODO, distinguish sent/pending once CORE sends it.
            outboxID,
            key: Constants.messageKey(common.conversationIDKey, 'messageIDText', common.messageID),
          }
        case ChatTypes.CommonMessageType.attachment: {
          const outboxID = payload.clientHeader.outboxID && Constants.outboxIDToKey(payload.clientHeader.outboxID)
          if (!payload.messageBody.attachment) {
            throw new Error('empty attachment body')
          }
          const attachment: ChatTypes.MessageAttachment = payload.messageBody.attachment
          const preview = attachment && (attachment.preview || attachment.previews && attachment.previews[0])
          const attachmentInfo = Constants.getAttachmentInfo(preview, attachment && attachment.object)

          let messageState
          if (attachment.uploaded) {
            messageState = 'sent'
          } else {
            messageState = common.author === common.you ? 'uploading' : 'placeholder'
          }

          return {
            type: 'Attachment',
            ...common,
            ...attachmentInfo,
            messageState,
            previewPath: null,
            downloadedPath: null,
            savedPath: null,
            previewProgress: null,
            downloadProgress: null,
            uploadProgress: null,
            outboxID,
            key: Constants.messageKey(common.conversationIDKey, 'messageIDAttachment', common.messageID),
          }
        }
        case ChatTypes.CommonMessageType.attachmentuploaded: {
          if (!payload.messageBody.attachmentuploaded) {
            throw new Error('empty attachmentuploaded body')
          }
          const attachmentUploaded: ChatTypes.MessageAttachmentUploaded = payload.messageBody.attachmentuploaded
          const previews = attachmentUploaded && attachmentUploaded.previews
          const preview = previews && previews[0]
          const attachmentInfo = Constants.getAttachmentInfo(preview, attachmentUploaded && attachmentUploaded.object)

          return {
            key: Constants.messageKey(common.conversationIDKey, 'messageIDAttachmentUpdate', common.messageID),
            messageID: common.messageID,
            targetMessageID: attachmentUploaded.messageID,
            timestamp: common.timestamp,
            type: 'UpdateAttachment',
            updates: {
              ...attachmentInfo,
              uploadProgress: null,
              messageState: 'sent',
            },
          }
        }
        case ChatTypes.CommonMessageType.delete:
          const deletedIDs = payload.messageBody.delete && payload.messageBody.delete.messageIDs || []
          return {
            type: 'Deleted',
            timestamp: payload.serverHeader.ctime,
            messageID: payload.serverHeader.messageID,
            key: Constants.messageKey(common.conversationIDKey, 'messageIDDeleted', common.messageID),
            deletedIDs,
          }
        case ChatTypes.CommonMessageType.edit: {
          const message = new HiddenString(payload.messageBody && payload.messageBody.edit && payload.messageBody.edit.body || '')
          const outboxID = payload.clientHeader.outboxID && Constants.outboxIDToKey(payload.clientHeader.outboxID)
          const targetMessageID = payload.messageBody.edit ? payload.messageBody.edit.messageID : 0
          return {
            key: Constants.messageKey(common.conversationIDKey, 'messageIDEdit', common.messageID),
            message,
            messageID: common.messageID,
            outboxID,
            targetMessageID,
            timestamp: common.timestamp,
            type: 'Edit',
          }
        }
        default:
          const unhandled: Constants.UnhandledMessage = {
            ...common,
            key: Constants.messageKey(common.conversationIDKey, 'messageIDUnhandled', common.messageID),
            type: 'Unhandled',
          }
          return unhandled
      }
    }
  }

  if (message.state === ChatTypes.LocalMessageUnboxedState.error) {
    const error = message.error
    if (error) {
      switch (error.errType) {
        case ChatTypes.LocalMessageUnboxedErrorType.misc:
        case ChatTypes.LocalMessageUnboxedErrorType.badversionCritical: // fallthrough
        case ChatTypes.LocalMessageUnboxedErrorType.identify: // fallthrough
          return {
            conversationIDKey,
            key: Constants.messageKey(conversationIDKey, 'messageIDError', errorIdx++),
            messageID: error.messageID,
            reason: error.errMsg || '',
            timestamp: error.ctime,
            type: 'Error',
          }
        case ChatTypes.LocalMessageUnboxedErrorType.badversion:
          return {
            conversationIDKey,
            key: Constants.messageKey(conversationIDKey, 'errorInvisible', errorIdx++),
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
    key: Constants.messageKey(conversationIDKey, 'error', errorIdx++),
    data: message,
    reason: "The message couldn't be loaded",
    conversationIDKey,
  }
}

function * _openTlfInChat (action: Constants.OpenTlfInChat): SagaGenerator<any, any> {
  const tlf = action.payload
  const me = yield select(usernameSelector)
  const userlist = parseFolderNameToUsers(me, tlf)
  const users = userlist.map(u => u.username)
  if (some(userlist, 'readOnly')) {
    console.warn('Bug: openTlfToChat should never be called on a convo with readOnly members.')
    return
  }
  yield put(Creators.startConversation(users))
}

function * _startConversation (action: Constants.StartConversation): SagaGenerator<any, any> {
  const {users, forceImmediate} = action.payload
  const me = yield select(usernameSelector)

  if (!users.includes(me)) {
    throw new Error('Attempted to start a chat without the current user')
  }

  const inboxSelector = (state: TypedState, tlfName: string) => {
    return state.chat.get('inbox').find(convo => convo.get('participants').sort().join(',') === tlfName)
  }
  const tlfName = users.sort().join(',')
  const existing = yield select(inboxSelector, tlfName)

  if (forceImmediate && existing) {
    const newID = yield call(Shared.startNewConversation, existing.get('conversationIDKey'))
    yield put(Creators.selectConversation(newID, false))
  } else if (existing) { // Select existing conversations
    yield put(Creators.selectConversation(existing.get('conversationIDKey'), false))
    yield put(switchTo([chatTab]))
  } else {
    // Make a pending conversation so it appears in the inbox
    const conversationIDKey = Constants.pendingConversationIDKey(tlfName)
    yield put(Creators.addPending(users))
    yield put(Creators.selectConversation(conversationIDKey, false))
    yield put(switchTo([chatTab]))
  }
}

function * _openFolder (): SagaGenerator<any, any> {
  const conversationIDKey = yield select(Constants.getSelectedConversation)

  const inbox = yield select(Shared.selectedInboxSelector, conversationIDKey)
  if (inbox) {
    const helper = inbox.get('info').visibility === ChatTypes.CommonTLFVisibility.public ? publicFolderWithUsers : privateFolderWithUsers
    const path = helper(inbox.get('participants').toArray())
    yield put(openInKBFS(path))
  } else {
    throw new Error(`Can't find conversation path`)
  }
}

function * _newChat (action: Constants.NewChat): SagaGenerator<any, any> {
  yield put(searchReset())

  const metaData = ((yield select(Shared.metaDataSelector)): any)
  const following = (yield select(Shared.followingSelector)) || {}

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

function * _updateMetadata (action: Constants.UpdateMetadata): SagaGenerator<any, any> {
  // Don't send sharing before signup values
  const metaData = yield select(Shared.metaDataSelector)
  const usernames = action.payload.users.filter(name => metaData.getIn([name, 'fullname']) === undefined && name.indexOf('@') === -1)
  if (!usernames.length) {
    return
  }

  try {
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
      payload[username] = new Constants.MetaDataRecord({fullname})
    })

    yield put(Creators.updatedMetadata(payload))
  } catch (err) {
    if (err && err.code === ConstantsStatusCode.scapinetworkerror) {
      // Ignore api errors due to offline
    } else {
      throw err
    }
  }
}

function * _selectConversation (action: Constants.SelectConversation): SagaGenerator<any, any> {
  const {conversationIDKey, fromUser} = action.payload

  // Load the inbox item always
  if (conversationIDKey) {
    yield put(Creators.getInboxAndUnbox([conversationIDKey]))
  }

  const oldConversationState = yield select(Shared.conversationStateSelector, conversationIDKey)
  if (oldConversationState && oldConversationState.get('isStale') && conversationIDKey) {
    yield put(Creators.clearMessages(conversationIDKey))
  }

  if (conversationIDKey) {
    yield put(Creators.loadMoreMessages(conversationIDKey, true, fromUser))
    yield put(navigateTo([conversationIDKey], [chatTab]))
  } else {
    yield put(navigateTo([], [chatTab]))
  }

  const inbox = yield select(Shared.selectedInboxSelector, conversationIDKey)
  if (inbox) {
    yield put(Creators.updateMetadata(inbox.get('participants').toArray()))
  }

  // Do this here because it's possible loadMoreMessages bails early
  // but there are still unread messages that need to be marked as read
  if (fromUser && conversationIDKey) {
    yield put(Creators.updateBadging(conversationIDKey))
    yield put(Creators.updateLatestMessage(conversationIDKey))
  }
}

function * _blockConversation (action: Constants.BlockConversation): SagaGenerator<any, any> {
  const {blocked, conversationIDKey, reportUser} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  if (blocked) {
    const status = reportUser
      ? ChatTypes.CommonConversationStatus.reported
      : ChatTypes.CommonConversationStatus.blocked
    const identifyBehavior: TLFIdentifyBehavior = TlfKeysTLFIdentifyBehavior.chatGui
    yield call(ChatTypes.localSetConversationStatusLocalRpcPromise, {
      param: {conversationID, identifyBehavior, status},
    })
  }
}

function * _muteConversation (action: Constants.MuteConversation): SagaGenerator<any, any> {
  const {conversationIDKey, muted} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  const status = muted ? ChatTypes.CommonConversationStatus.muted : ChatTypes.CommonConversationStatus.unfiled
  const identifyBehavior: TLFIdentifyBehavior = TlfKeysTLFIdentifyBehavior.chatGui
  yield call(ChatTypes.localSetConversationStatusLocalRpcPromise, {
    param: {conversationID, identifyBehavior, status},
  })
}

function * _updateBadging (action: Constants.UpdateBadging): SagaGenerator<any, any> {
  // Update gregor's view of the latest message we've read.
  const {conversationIDKey} = action.payload
  const conversationState = yield select(Shared.conversationStateSelector, conversationIDKey)
  if (conversationState && conversationState.messages !== null && conversationState.messages.size > 0) {
    const conversationID = Constants.keyToConversationID(conversationIDKey)
    const msgID = conversationState.messages.get(conversationState.messages.size - 1).messageID
    yield call(ChatTypes.localMarkAsReadLocalRpcPromise, {
      param: {conversationID, msgID},
    })
  }
}

function * _changedFocus (action: ChangedFocus): SagaGenerator<any, any> {
  // Update badging and the latest message due to the refocus.
  const {appFocused} = action.payload
  const conversationIDKey = yield select(Constants.getSelectedConversation)
  const selectedTab = yield select(Shared.routeSelector)
  const chatTabSelected = (selectedTab === chatTab)

  if (conversationIDKey && chatTabSelected) {
    if (appFocused) {
      yield put(Creators.updateBadging(conversationIDKey))
    } else {
      // Reset the orange line when focus leaves the app.
      yield put(Creators.updateLatestMessage(conversationIDKey))
    }
  }
}

function * _badgeAppForChat (action: Constants.BadgeAppForChat): SagaGenerator<any, any> {
  const conversations = action.payload
  let conversationsWithKeys = {}
  conversations.map(conv => {
    conversationsWithKeys[Constants.conversationIDToKey(conv.get('convID'))] = conv.get('UnreadMessages')
  })
  const conversationUnreadCounts = conversations.reduce((map, conv) => {
    const count = conv.get('UnreadMessages')
    if (!count) {
      return map
    } else {
      return map.set(Constants.conversationIDToKey(conv.get('convID')), count)
    }
  }, Map())
  yield put(Creators.updateConversationUnreadCounts(conversationUnreadCounts))
}

function * _sendNotifications (action: Constants.AppendMessages): SagaGenerator<any, any> {
  const appFocused = yield select(Shared.focusedSelector)
  const selectedTab = yield select(Shared.routeSelector)
  const chatTabSelected = (selectedTab === chatTab)
  const convoIsSelected = action.payload.isSelected

  console.log('Deciding whether to notify new message:', convoIsSelected, appFocused, chatTabSelected)
  // Only send if you're not looking at it
  if (!convoIsSelected || !appFocused || !chatTabSelected) {
    const me = yield select(usernameSelector)
    const message = (action.payload.messages.reverse().find(m => m.type === 'Text' && m.author !== me))
    // Is this message part of a muted conversation? If so don't notify.
    const convo = yield select(Shared.selectedInboxSelector, action.payload.conversationIDKey)
    if (convo && convo.get('status') !== 'muted') {
      if (message && message.type === 'Text') {
        console.log('Sending Chat notification')
        const snippet = Constants.makeSnippet(Constants.serverMessageToMessageBody(message))
        yield put((dispatch: Dispatch) => {
          NotifyPopup(message.author, {body: snippet}, -1, message.author, () => {
            dispatch(Creators.selectConversation(action.payload.conversationIDKey, false))
            dispatch(switchTo([chatTab]))
            dispatch(showMainWindow())
          })
        })
      }
    }
  }
}

function * _markThreadsStale (action: Constants.MarkThreadsStale): SagaGenerator<any, any> {
  // Load inbox items of any stale items so we get update on rekeyInfos, etc
  const {convIDs} = action.payload
  yield call(Inbox.unboxConversations, convIDs)

  // Selected is stale?
  const selectedConversation = yield select(Constants.getSelectedConversation)
  if (!selectedConversation) {
    return
  }
  yield put(Creators.clearMessages(selectedConversation))
  yield put(Creators.loadMoreMessages(selectedConversation, false))
}

function _threadIsCleared (originalAction: Action, checkAction: Action): boolean {
  return originalAction.type === 'chat:loadMoreMessages' && checkAction.type === 'chat:clearMessages' && originalAction.conversationIDKey === checkAction.conversationIDKey
}

function * _openConversation ({payload: {conversationIDKey}}: Constants.OpenConversation): SagaGenerator<any, any> {
  const inbox = yield select(inboxSelector)
  const validInbox = inbox.find(c => c.get('conversationIDKey') === conversationIDKey && c.get('state') === 'unboxed')
  if (!validInbox) {
    yield put(Creators.getInboxAndUnbox([conversationIDKey]))
    const raceResult: {[key: string]: any} = yield race({
      updateInbox: take(a => a.type === 'chat:updateInbox' && a.payload.conversation && a.payload.conversation.conversationIDKey === conversationIDKey),
      timeout: call(delay, 10e3),
    })
    if (raceResult.updateInbox) {
      yield put(Creators.selectConversation(conversationIDKey, false))
    }
  } else {
    yield put(Creators.selectConversation(conversationIDKey, false))
  }
}

function * chatSaga (): SagaGenerator<any, any> {
  yield Saga.safeTakeEvery('app:changedFocus', _changedFocus)
  yield Saga.safeTakeEvery('chat:appendMessages', _sendNotifications)
  yield Saga.safeTakeEvery('chat:blockConversation', _blockConversation)
  yield Saga.safeTakeEvery('chat:deleteMessage', Messages.deleteMessage)
  yield Saga.safeTakeEvery('chat:editMessage', Messages.editMessage)
  yield Saga.safeTakeEvery('chat:getInboxAndUnbox', Inbox.onGetInboxAndUnbox)
  yield Saga.safeTakeEvery('chat:incomingMessage', _incomingMessage)
  yield Saga.safeTakeEvery('chat:loadAttachment', Attachment.onLoadAttachment)
  yield Saga.safeTakeEvery('chat:loadAttachmentPreview', Attachment.onLoadAttachmentPreview)
  yield Saga.safeTakeEvery('chat:loadMoreMessages', Saga.cancelWhen(_threadIsCleared, _loadMoreMessages))
  yield Saga.safeTakeEvery('chat:loadedInbox', _ensureValidSelectedChat, true, false)
  yield Saga.safeTakeEvery('chat:markThreadsStale', _markThreadsStale)
  yield Saga.safeTakeEvery('chat:muteConversation', _muteConversation)
  yield Saga.safeTakeEvery('chat:newChat', _newChat)
  yield Saga.safeTakeEvery('chat:openAttachmentPopup', Attachment.onOpenAttachmentPopup)
  yield Saga.safeTakeEvery('chat:openConversation', _openConversation)
  yield Saga.safeTakeEvery('chat:openFolder', _openFolder)
  yield Saga.safeTakeEvery('chat:openTlfInChat', _openTlfInChat)
  yield Saga.safeTakeEvery('chat:postMessage', Messages.postMessage)
  yield Saga.safeTakeEvery('chat:retryMessage', Messages.retryMessage)
  yield Saga.safeTakeEvery('chat:saveAttachment', Attachment.onSaveAttachment)
  yield Saga.safeTakeEvery('chat:saveAttachmentNative', Attachment.onSaveAttachmentNative)
  yield Saga.safeTakeEvery('chat:selectAttachment', Attachment.onSelectAttachment)
  yield Saga.safeTakeEvery('chat:setupChatHandlers', _setupChatHandlers)
  yield Saga.safeTakeEvery('chat:shareAttachment', Attachment.onShareAttachment)
  yield Saga.safeTakeEvery('chat:startConversation', _startConversation)
  yield Saga.safeTakeEvery('chat:untrustedInboxVisible', Inbox.untrustedInboxVisible)
  yield Saga.safeTakeEvery('chat:updateBadging', _updateBadging)
  yield Saga.safeTakeEvery('chat:updateInboxComplete', _ensureValidSelectedChat, false, false)
  yield Saga.safeTakeEvery('chat:updateMetadata', _updateMetadata)
  yield Saga.safeTakeLatest('chat:badgeAppForChat', _badgeAppForChat)
  yield Saga.safeTakeLatest('chat:inboxStale', Inbox.onInboxStale)
  yield Saga.safeTakeLatest('chat:loadInbox', Inbox.onInitialInboxLoad)
  yield Saga.safeTakeLatest('chat:selectConversation', _selectConversation)
}

export default chatSaga

export {
  badgeAppForChat,
  openTlfInChat,
  setupChatHandlers,
  startConversation,
  setInitialConversation,
  untrustedInboxVisible,
} from './creators'
