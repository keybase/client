// @flow
import * as Attachment from './attachment'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as SearchConstants from '../../constants/search'
import * as Creators from './creators'
import * as EntityCreators from '../entities'
import * as SearchCreators from '../search/creators'
import * as Inbox from './inbox'
import * as Messages from './messages'
import * as Shared from './shared'
import * as Saga from '../../util/saga'
import * as EngineRpc from '../engine/helper'
import * as I from 'immutable'
import HiddenString from '../../util/hidden-string'
import engine from '../../engine'
import {NotifyPopup} from '../../native/notifications'
import {
  apiserverGetRpcPromise,
  TlfKeysTLFIdentifyBehavior,
  CommonDeviceType,
  CommonTLFVisibility,
  ConstantsStatusCode,
} from '../../constants/types/flow-types'
import {call, put, all, select} from 'redux-saga/effects'
import {isMobile} from '../../constants/platform'
import {navigateTo, switchTo} from '../route-tree'
import {openInKBFS} from '../kbfs'
import {parseFolderNameToUsers} from '../../util/kbfs'
import {publicFolderWithUsers, privateFolderWithUsers, teamFolder} from '../../constants/config'
import {chatTab} from '../../constants/tabs'
import {showMainWindow} from '../platform-specific'
import some from 'lodash/some'
import {toDeviceType} from '../../constants/types/more'
import {usernameSelector, previousConversationSelector} from '../../constants/selectors'

import type {Action} from '../../constants/types/flux'
import type {ReturnValue} from '../../constants/types/more'
import type {ChangedFocus, ChangedActive} from '../../constants/app'
import type {TLFIdentifyBehavior} from '../../constants/types/flow-types'
import type {SagaGenerator} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'

const inSearchSelector = (state: TypedState) => state.chat.get('inSearch')
// How many messages we consider too many to just download when you are stale and we could possibly just append
const tooManyMessagesToJustAppendOnStale = 200

function* _incomingMessage(action: Constants.IncomingMessage): SagaGenerator<any, any> {
  switch (action.payload.activity.activityType) {
    case ChatTypes.NotifyChatChatActivityType.setStatus:
      const setStatus: ?ChatTypes.SetStatusInfo = action.payload.activity.setStatus
      if (setStatus) {
        yield call(Inbox.processConversation, setStatus.conv)
      }
      return
    case ChatTypes.NotifyChatChatActivityType.failedMessage:
      const failedMessage: ?ChatTypes.FailedMessageInfo = action.payload.activity.failedMessage
      if (failedMessage && failedMessage.outboxRecords) {
        for (const outboxRecord of failedMessage.outboxRecords) {
          const conversationIDKey = Constants.conversationIDToKey(outboxRecord.convID)
          const outboxID = outboxRecord.outboxID && Constants.outboxIDToKey(outboxRecord.outboxID)
          // $FlowIssue
          const errTyp = outboxRecord.state.error.typ
          const failureDescription = _decodeFailureDescription(errTyp)
          const isConversationLoaded = yield select(Shared.conversationStateSelector, conversationIDKey)
          if (!isConversationLoaded) return

          const pendingMessage = yield select(Shared.messageOutboxIDSelector, conversationIDKey, outboxID)
          if (pendingMessage) {
            yield put(
              Creators.updateTempMessage(
                conversationIDKey,
                {
                  ...pendingMessage,
                  failureDescription,
                  messageState: 'failed',
                },
                outboxID
              )
            )
          } else {
            throw new Error("Pending message wasn't found!")
          }
        }
      }
      return
    case ChatTypes.NotifyChatChatActivityType.readMessage:
      if (action.payload.activity.readMessage) {
        const inboxUIItem: ?ChatTypes.InboxUIItem = action.payload.activity.readMessage.conv
        if (inboxUIItem) {
          yield call(Inbox.processConversation, inboxUIItem)
        }
      }
      return
    case ChatTypes.NotifyChatChatActivityType.incomingMessage:
      const incomingMessage: ?ChatTypes.IncomingMessage = action.payload.activity.incomingMessage
      if (incomingMessage) {
        // If it's a public chat, the GUI (currently) wants no part of it. We
        // especially don't want to surface the conversation as if it were a
        // private one, which is what we were doing before this change.
        if (incomingMessage.conv && incomingMessage.conv.visibility !== CommonTLFVisibility.private) {
          return
        }

        const conversationIDKey = Constants.conversationIDToKey(incomingMessage.convID)
        if (incomingMessage.conv) {
          yield call(Inbox.processConversation, incomingMessage.conv)
        } else {
          // Sometimes (just for deletes?) we get an incomingMessage without
          // a conv object -- in that case, ask the service to give us an
          // updated one so that the snippet etc gets updated.
          yield put(Creators.unboxConversations([conversationIDKey], 'no conv from incoming message', true))
        }

        const messageUnboxed: ChatTypes.UIMessage = incomingMessage.message
        const yourName = yield select(usernameSelector)
        const yourDeviceName = yield select(Shared.devicenameSelector)
        const message: Constants.ServerMessage = _unboxedToMessage(
          messageUnboxed,
          yourName,
          yourDeviceName,
          conversationIDKey
        )
        if (message.type === 'Unhandled') {
          return
        }
        const svcShouldDisplayNotification = incomingMessage.displayDesktopNotification

        // Is this message for the currently selected and focused conversation?
        // And is the Chat tab the currently displayed route? If all that is
        // true, mark it as read ASAP to avoid badging it -- we don't need to
        // badge, the user's looking at it already.  Also mark as read ASAP if
        // it was written by the current user.
        const selectedConversationIDKey = yield select(Constants.getSelectedConversation)
        const appFocused = yield select(Shared.focusedSelector)
        const userActive = yield select(Shared.activeSelector)
        const selectedTab = yield select(Shared.routeSelector)
        const chatTabSelected = selectedTab === chatTab
        const conversationIsFocused =
          conversationIDKey === selectedConversationIDKey && appFocused && chatTabSelected && userActive
        if (message.messageID && conversationIsFocused) {
          const {type: msgIDType} = Constants.parseMessageID(message.messageID)
          if (msgIDType === 'rpcMessageID') {
            yield call(_markAsRead, conversationIDKey, message.messageID)
          }
        }

        const messageFromYou =
          message.deviceName === yourDeviceName && message.author && yourName === message.author

        if (
          (message.type === 'Text' || message.type === 'Attachment') &&
          messageFromYou &&
          message.outboxID
        ) {
          const outboxID: Constants.OutboxIDKey = message.outboxID
          const state = yield select()
          const pendingMessage = Shared.messageOutboxIDSelector(state, conversationIDKey, outboxID)

          if (pendingMessage) {
            yield all([
              // If the message has an outboxID and came from our device, then we
              // sent it and have already rendered it in the message list; we just
              // need to mark it as sent.
              put(Creators.updateTempMessage(conversationIDKey, message, outboxID)),
              put(Creators.outboxMessageBecameReal(pendingMessage.key, message.key)),
            ])

            const messageID = message.messageID
            if (messageID) {
              yield put(
                Creators.markSeenMessage(
                  conversationIDKey,
                  Constants.messageKey(
                    conversationIDKey,
                    message.type === 'Text' ? 'messageIDText' : 'messageIDAttachment',
                    messageID
                  )
                )
              )
            }
          } else {
            yield put(
              Creators.appendMessages(
                conversationIDKey,
                conversationIDKey === selectedConversationIDKey,
                appFocused,
                [message],
                svcShouldDisplayNotification
              )
            )
          }
        }
      }
      break
    case ChatTypes.NotifyChatChatActivityType.setAppNotificationSettings:
      if (action.payload.activity && action.payload.activity.setAppNotificationSettings) {
        const {convID, settings} = action.payload.activity.setAppNotificationSettings
        if (convID && settings) {
          const conversationIDKey = Constants.conversationIDToKey(convID)
          const notifications = Inbox.parseNotifications(settings)
          if (notifications) {
            yield put(Creators.updatedNotifications(conversationIDKey, notifications))
          }
        }
      }
      break
    case ChatTypes.NotifyChatChatActivityType.teamtype:
      // Just reload everything if we get one of these
      yield put(Creators.inboxStale('team type changed'))
      break
    case ChatTypes.NotifyChatChatActivityType.newConversation:
      const newConv: ?ChatTypes.NewConversationInfo = action.payload.activity.newConversation
      if (newConv && newConv.conv) {
        yield call(Inbox.processConversation, newConv.conv)
        break
      }
      // Just reload everything if we get this with no InboxUIItem
      console.log('newConversation with no InboxUIItem')
      yield put(Creators.inboxStale('no inbox item for new conv message'))
      break
    default:
      console.warn(
        'Unsupported incoming message type for Chat of type:',
        action.payload.activity.activityType
      )
  }
}

function* _incomingTyping(action: Constants.IncomingTyping): SagaGenerator<any, any> {
  // $FlowIssue
  for (const activity of action.payload.activity) {
    const conversationIDKey = Constants.conversationIDToKey(activity.convID)
    const typers = activity.typers || []
    const typing = typers.map(typer => typer.username)
    yield put(Creators.setTypers(conversationIDKey, typing))
  }
}

function* _setupChatHandlers(): SagaGenerator<any, any> {
  engine().setIncomingActionCreator('chat.1.NotifyChat.NewChatActivity', ({activity}) =>
    Creators.incomingMessage(activity)
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatTypingUpdate', ({typingUpdates}) =>
    Creators.incomingTyping(typingUpdates)
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatIdentifyUpdate', ({update}) => {
    const usernames = update.CanonicalName.split(',')
    const broken = (update.breaks.breaks || []).map(b => b.user.username)
    const userToBroken = usernames.reduce((map, name) => {
      map[name] = !!broken.includes(name)
      return map
    }, {})
    return Creators.updateBrokenTracker(userToBroken)
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatTLFFinalize', ({convID}) =>
    Creators.getInboxAndUnbox([Constants.conversationIDToKey(convID)])
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxStale', () =>
    Creators.inboxStale('service invoked')
  )

  engine().setIncomingActionCreator(
    'chat.1.NotifyChat.ChatTLFResolve',
    ({convID, resolveInfo: {newTLFName}}) => Creators.inboxStale('TLF resolve notification')
  )

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatThreadsStale', ({updates}) => {
    if (updates) {
      return Creators.markThreadsStale(updates)
    }
    return null
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxSynced', ({syncRes}) => {
    switch (syncRes.syncType) {
      case ChatTypes.CommonSyncInboxResType.clear:
        return Creators.inboxStale('sync with clear result')
      case ChatTypes.CommonSyncInboxResType.current:
        return Creators.setInboxUntrustedState('loaded')
      case ChatTypes.CommonSyncInboxResType.incremental:
        return Creators.inboxSynced(syncRes.incremental.items)
    }
    return Creators.inboxStale('sync with unknown result')
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatInboxSyncStarted', () => {
    return Creators.setInboxUntrustedState('loading')
  })

  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatJoinedConversation', () =>
    Creators.inboxStale('joined a conversation')
  )
  engine().setIncomingActionCreator('chat.1.NotifyChat.ChatLeftConversation', () =>
    Creators.inboxStale('left a conversation')
  )
}

const inboxSelector = (state: TypedState) => state.entities.get('inbox')

function* _updateThread({
  payload: {yourName, thread, yourDeviceName, conversationIDKey, append},
}: Constants.UpdateThread) {
  let newMessages = []
  const newUnboxeds = (thread && thread.messages) || []
  for (const unboxed of newUnboxeds) {
    const message: Constants.ServerMessage = _unboxedToMessage(
      unboxed,
      yourName,
      yourDeviceName,
      conversationIDKey
    )
    const messageFromYou =
      message.deviceName === yourDeviceName && message.author && yourName === message.author

    if ((message.type === 'Text' || message.type === 'Attachment') && messageFromYou && message.outboxID) {
      const outboxID: Constants.OutboxIDKey = message.outboxID
      const state = yield select()
      const pendingMessage = Shared.messageOutboxIDSelector(state, conversationIDKey, outboxID)
      if (pendingMessage) {
        // Delete the pre-existing pending version of this message, since we're
        // about to add a newly received version of the same message.
        yield put(Creators.removeOutboxMessage(conversationIDKey, outboxID))
      }
    }

    if (message.type !== 'Unhandled') {
      newMessages.push(message)
    }
  }

  newMessages = newMessages.reverse()
  if (append) {
    const selectedConversationIDKey = yield select(Constants.getSelectedConversation)
    const appFocused = yield select(Shared.focusedSelector)

    yield put(
      Creators.appendMessages(
        conversationIDKey,
        conversationIDKey === selectedConversationIDKey,
        appFocused,
        newMessages,
        false
      )
    )
  } else {
    const last = thread && thread.pagination && thread.pagination.last
    yield put(Creators.prependMessages(conversationIDKey, newMessages, !last))
  }
}

function subSagaUpdateThread(yourName, yourDeviceName, conversationIDKey, append) {
  return function* subSagaUpdateThreadHelper({thread}) {
    if (thread) {
      const decThread: ChatTypes.UIMessages = JSON.parse(thread)
      yield put(Creators.updateThread(decThread, yourName, yourDeviceName, conversationIDKey, append))
    }
    return EngineRpc.rpcResult()
  }
}

const getThreadNonblockSagaMap = (yourName, yourDeviceName, conversationIDKey, append) => ({
  'chat.1.chatUi.chatThreadCached': subSagaUpdateThread(yourName, yourDeviceName, conversationIDKey, append),
  'chat.1.chatUi.chatThreadFull': subSagaUpdateThread(yourName, yourDeviceName, conversationIDKey, append),
})

function* _loadMoreMessages(action: Constants.LoadMoreMessages): SagaGenerator<any, any> {
  const conversationIDKey = action.payload.conversationIDKey
  const recent = action.payload.wantNewer === true

  try {
    if (!conversationIDKey) {
      return
    }

    if (Constants.isPendingConversationIDKey(conversationIDKey)) {
      console.log('Bailing on selected pending conversation no matching inbox')
      return
    }

    const untrustedState = yield select(state => state.entities.inboxUntrustedState.get(conversationIDKey))

    // only load unboxed things
    if (!['unboxed', 'reUnboxing'].includes(untrustedState)) {
      console.log('Bailing on not yet unboxed conversation', untrustedState)
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
    if (oldConversationState && !recent) {
      if (action.payload.onlyIfUnloaded && oldConversationState.get('isLoaded')) {
        console.log('Bailing on chat load more due to already has initial load')
        return
      }

      if (oldConversationState.get('isRequesting')) {
        console.log('Bailing on chat load more due to isRequesting already')
        return
      }

      if (oldConversationState.get('moreToLoad') === false) {
        console.log('Bailing on chat load more due to no more to load')
        return
      }
    }

    yield put(Creators.loadingMessages(conversationIDKey, true))

    const yourName = yield select(usernameSelector)
    const yourDeviceName = yield select(Shared.devicenameSelector)

    // We receive the list with edit/delete/etc already applied so lets filter that out
    const messageTypes = Object.keys(ChatTypes.CommonMessageType)
      .filter(k => !['edit', 'delete', 'headline', 'attachmentuploaded'].includes(k))
      .map(k => ChatTypes.CommonMessageType[k])
    const conversationID = Constants.keyToConversationID(conversationIDKey)

    const messageKeys = yield select(Constants.getConversationMessages, conversationIDKey)
    // Find a real message id (ignore outbox etc)
    let pivotMessageKey = recent
      ? messageKeys.findLast(Constants.messageKeyKindIsMessageID)
      : messageKeys.find(Constants.messageKeyKindIsMessageID)

    let pivot
    if (pivotMessageKey) {
      const message = yield select(Constants.getMessageFromMessageKey, pivotMessageKey)
      pivot = message ? message.rawMessageID : null
    }

    const loadThreadChanMapRpc = new EngineRpc.EngineRpcCall(
      getThreadNonblockSagaMap(yourName, yourDeviceName, conversationIDKey, recent),
      ChatTypes.localGetThreadNonblockRpcChannelMap,
      'localGetThreadNonblock',
      {
        param: {
          conversationID,
          identifyBehavior: TlfKeysTLFIdentifyBehavior.chatGui,
          query: {
            disableResolveSupersedes: false,
            markAsRead: true,
            messageTypes,
            messageIDControl: {
              pivot,
              recent,
              num: action.payload.numberOverride || Constants.maxMessagesToLoadAtATime,
            },
          },
        },
      }
    )

    const result = yield call(loadThreadChanMapRpc.run)

    if (EngineRpc.isFinished(result)) {
      const {payload: {params, error}} = result

      if (error) {
        console.warn('error in localGetThreadNonblock', error)
      }

      if (params.offline) {
        yield put(Creators.threadLoadedOffline(conversationIDKey))
      }

      yield put(Creators.setLoaded(conversationIDKey, !error)) // reset isLoaded on error
    } else {
      console.warn('localGetThreadNonblock rpc bailed early')
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

// used to key errors. Negative so that we know we made this up and didn't get it from the server
let errorIdx = -1

function _decodeFailureDescription(typ: ChatTypes.OutboxErrorType): string {
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

function _parseChannelMention(channelMention: ChatTypes.ChannelMention): Constants.ChannelMention {
  switch (channelMention) {
    case ChatTypes.RemoteChannelMention.all:
      return 'All'
    case ChatTypes.RemoteChannelMention.here:
      return 'Here'
    default:
      return 'None'
  }
}

function _unboxedToMessage(
  message: ChatTypes.UIMessage,
  yourName,
  yourDeviceName,
  conversationIDKey: Constants.ConversationIDKey
): Constants.ServerMessage {
  if (message && message.state === ChatTypes.ChatUiMessageUnboxedState.outbox && message.outbox) {
    // Outbox messages are always text, not attachments.
    const payload: ChatTypes.UIMessageOutbox = message.outbox
    // prettier-ignore
    const messageState: Constants.MessageState = payload &&
      payload.state &&
      payload.state.state === ChatTypes.LocalOutboxStateType.error
      ? 'failed'
      : 'pending'
    // prettier-ignore
    const failureDescription = messageState === 'failed'
      // $FlowIssue
      ? _decodeFailureDescription(payload.state.error.typ)
      : null
    // $FlowIssue
    const messageText: ChatTypes.MessageText = message.outbox.body
    const outboxIDKey = payload.outboxID && Constants.outboxIDToKey(payload.outboxID)

    return {
      author: yourName,
      channelMention: 'None',
      conversationIDKey,
      deviceName: yourDeviceName,
      deviceType: isMobile ? 'mobile' : 'desktop',
      editedCount: 0,
      failureDescription,
      key: Constants.messageKey(conversationIDKey, 'outboxIDText', outboxIDKey),
      mentions: I.Set(),
      message: new HiddenString((messageText && messageText.body) || ''),
      messageState,
      outboxID: outboxIDKey,
      rawMessageID: -1,
      senderDeviceRevokedAt: null,
      timestamp: payload.ctime,
      type: 'Text',
      you: yourName,
    }
  }

  if (message.state === ChatTypes.ChatUiMessageUnboxedState.valid) {
    const payload = message.valid
    if (payload) {
      const common = {
        author: payload.senderUsername,
        channelMention: _parseChannelMention(payload.channelMention),
        conversationIDKey,
        deviceName: payload.senderDeviceName,
        deviceType: toDeviceType(payload.senderDeviceType),
        failureDescription: null,
        mentions: I.Set(payload.atMentions || []),
        messageID: Constants.rpcMessageIDToMessageID(payload.messageID),
        rawMessageID: payload.messageID,
        outboxID: payload.outboxID && Constants.outboxIDToKey(payload.outboxID),
        senderDeviceRevokedAt: payload.senderDeviceRevokedAt,
        timestamp: payload.ctime,
        you: yourName,
      }

      switch (payload.messageBody.messageType) {
        case ChatTypes.CommonMessageType.text:
          const p: any = payload
          const message = new HiddenString(
            (p.messageBody && p.messageBody.text && p.messageBody.text.body) || ''
          )
          // end to del
          return {
            type: 'Text',
            ...common,
            editedCount: payload.superseded ? 1 : 0, // mark it as edited if it's been superseded
            message,
            messageState: 'sent', // TODO, distinguish sent/pending once CORE sends it.
            key: Constants.messageKey(common.conversationIDKey, 'messageIDText', common.messageID),
          }
        case ChatTypes.CommonMessageType.attachment: {
          if (!payload.messageBody.attachment) {
            throw new Error('empty attachment body')
          }
          const attachment: ChatTypes.MessageAttachment = payload.messageBody.attachment
          const preview =
            attachment && (attachment.preview || (attachment.previews && attachment.previews[0]))
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
            key: Constants.messageKey(common.conversationIDKey, 'messageIDAttachment', common.messageID),
          }
        }
        case ChatTypes.CommonMessageType.attachmentuploaded: {
          if (!payload.messageBody.attachmentuploaded) {
            throw new Error('empty attachmentuploaded body')
          }
          const attachmentUploaded: ChatTypes.MessageAttachmentUploaded =
            payload.messageBody.attachmentuploaded
          const previews = attachmentUploaded && attachmentUploaded.previews
          const preview = previews && previews[0]
          const attachmentInfo = Constants.getAttachmentInfo(
            preview,
            attachmentUploaded && attachmentUploaded.object
          )

          return {
            key: Constants.messageKey(
              common.conversationIDKey,
              'messageIDAttachmentUpdate',
              common.messageID
            ),
            messageID: common.messageID,
            targetMessageID: Constants.rpcMessageIDToMessageID(attachmentUploaded.messageID),
            timestamp: common.timestamp,
            type: 'UpdateAttachment',
            updates: {
              ...attachmentInfo,
              messageState: 'sent',
            },
          }
        }
        case ChatTypes.CommonMessageType.delete:
          const deletedIDs = ((payload.messageBody.delete && payload.messageBody.delete.messageIDs) || [])
            .map(Constants.rpcMessageIDToMessageID)
          return {
            type: 'Deleted',
            timestamp: payload.ctime,
            messageID: common.messageID,
            key: Constants.messageKey(common.conversationIDKey, 'messageIDDeleted', common.messageID),
            deletedIDs,
          }
        case ChatTypes.CommonMessageType.edit: {
          const message = new HiddenString(
            (payload.messageBody && payload.messageBody.edit && payload.messageBody.edit.body) || ''
          )
          const targetMessageID = payload.messageBody.edit
            ? Constants.rpcMessageIDToMessageID(payload.messageBody.edit.messageID)
            : ''
          return {
            key: Constants.messageKey(common.conversationIDKey, 'messageIDEdit', common.messageID),
            message,
            messageID: common.messageID,
            outboxID: common.outboxID,
            mentions: common.mentions,
            channelMention: common.channelMention,
            targetMessageID,
            timestamp: common.timestamp,
            type: 'Edit',
          }
        }
        case ChatTypes.CommonMessageType.join: {
          const message = new HiddenString('joined')
          return {
            type: 'System',
            messageID: common.messageID,
            author: common.author,
            timestamp: common.timestamp,
            message,
            key: Constants.messageKey(common.conversationIDKey, 'system', common.messageID),
          }
        }
        case ChatTypes.CommonMessageType.leave: {
          const message = new HiddenString('left')
          return {
            type: 'System',
            messageID: common.messageID,
            author: common.author,
            timestamp: common.timestamp,
            message,
            key: Constants.messageKey(common.conversationIDKey, 'system', common.messageID),
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

  if (message.state === ChatTypes.ChatUiMessageUnboxedState.error) {
    const error = message.error
    if (error) {
      switch (error.errType) {
        case ChatTypes.LocalMessageUnboxedErrorType.misc:
        case ChatTypes.LocalMessageUnboxedErrorType.badversionCritical: // fallthrough
        case ChatTypes.LocalMessageUnboxedErrorType.identify: // fallthrough
          return {
            conversationIDKey,
            key: Constants.messageKey(
              conversationIDKey,
              'messageIDError',
              Constants.rpcMessageIDToMessageID(error.messageID)
            ),
            messageID: Constants.rpcMessageIDToMessageID(error.messageID),
            reason: error.errMsg || '',
            timestamp: error.ctime,
            type: 'Error',
          }
        case ChatTypes.LocalMessageUnboxedErrorType.badversion:
          return {
            conversationIDKey,
            key: Constants.messageKey(
              conversationIDKey,
              'errorInvisible',
              Constants.rpcMessageIDToMessageID(error.messageID)
            ),
            data: message,
            messageID: Constants.rpcMessageIDToMessageID(error.messageID),
            timestamp: error.ctime,
            type: 'InvisibleError',
          }
      }
    }
  }

  return {
    type: 'Error',
    key: Constants.messageKey(
      conversationIDKey,
      'error',
      // $FlowIssue
      message && message.messageID && typeof message.messageID === 'number'
        ? Constants.rpcMessageIDToMessageID(message.messageID)
        : Constants.selfInventedIDToMessageID(errorIdx--)
    ),
    data: message,
    reason: "The message couldn't be loaded",
    conversationIDKey,
  }
}

function* _openTlfInChat(action: Constants.OpenTlfInChat): SagaGenerator<any, any> {
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

function* _startConversation(action: Constants.StartConversation): SagaGenerator<any, any> {
  const {users, forceImmediate, temporary} = action.payload
  const me = yield select(usernameSelector)

  if (!users.includes(me)) {
    users.push(me)
    console.warn('Attempted to start a chat without the current user')
  }

  // not effecient but only happens when you start a new convo and not over and over
  const tlfName = users.sort().join(',')
  const inbox = yield select(inboxSelector)
  const existing = inbox.find(
    state =>
      state.get('membersType') === ChatTypes.CommonConversationMembersType.kbfs &&
      state.get('participants').sort().join(',') === tlfName
  )

  if (forceImmediate && existing) {
    const newID = yield call(Shared.startNewConversation, existing.get('conversationIDKey'))
    if (newID && newID[0]) {
      yield put(Creators.selectConversation(newID[0], false))
    }
  } else if (existing) {
    // Select existing conversations
    yield put(Creators.selectConversation(existing.get('conversationIDKey'), false))
    yield put(switchTo([chatTab]))
  } else {
    // Make a pending conversation so it appears in the inbox
    const conversationIDKey = Constants.pendingConversationIDKey(tlfName)
    yield put(Creators.addPending(users, temporary))
    yield put(Creators.selectConversation(conversationIDKey, false))
    yield put(switchTo([chatTab]))
  }
}

function* _openFolder(): SagaGenerator<any, any> {
  const conversationIDKey = yield select(Constants.getSelectedConversation)

  const inbox = yield select(Constants.getInbox, conversationIDKey)
  if (inbox) {
    let path
    if (inbox.membersType === ChatTypes.CommonConversationMembersType.team) {
      path = teamFolder(inbox.teamname)
    } else {
      const helper = inbox.visibility === CommonTLFVisibility.public
        ? publicFolderWithUsers
        : privateFolderWithUsers
      path = helper(inbox.get('participants').toArray())
    }
    yield put(openInKBFS(path))
  } else {
    throw new Error(`Can't find conversation path`)
  }
}

function* _newChat(action: Constants.NewChat): SagaGenerator<any, any> {
  yield put(Creators.setInboxFilter(''))
  const ids = yield select(SearchConstants.getUserInputItemIds, {searchKey: 'chatSearch'})
  if (ids && !!ids.length) {
    // Ignore 'New Chat' attempts when we're already building a chat
    return
  }
  yield put(Creators.setPreviousConversation(yield select(Constants.getSelectedConversation)))
  yield put(Creators.selectConversation(null, false))
  yield put(SearchCreators.searchSuggestions('chatSearch'))
}

function* _updateMetadata(action: Constants.UpdateMetadata): SagaGenerator<any, any> {
  // Don't send sharing before signup values
  const metaData = yield select(Shared.metaDataSelector)
  const usernames = action.payload.users.filter(
    name =>
      metaData.getIn([name, 'fullname']) === undefined && name.indexOf('@') === -1 && name.indexOf('#') === -1
  )
  if (!usernames.length) {
    return
  }

  try {
    const results: any = yield call(apiserverGetRpcPromise, {
      param: {
        endpoint: 'user/lookup',
        args: [{key: 'usernames', value: usernames.join(',')}, {key: 'fields', value: 'profile'}],
      },
    })

    const parsed = JSON.parse(results.body)
    const payload = {}
    usernames.forEach((username, idx) => {
      const record = parsed.them[idx]
      const fullname = (record && record.profile && record.profile.full_name) || ''
      payload[username] = Constants.makeMetaData({fullname})
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

function* _selectConversation(action: Constants.SelectConversation): SagaGenerator<any, any> {
  const {conversationIDKey, fromUser} = action.payload

  // Always show this in the inbox
  if (conversationIDKey) {
    yield put(EntityCreators.mergeEntity(['inboxAlwaysShow'], I.Map({[conversationIDKey]: true})))
  }

  if (fromUser) {
    yield put(Creators.exitSearch(true))
  }

  // Load the inbox item always
  if (conversationIDKey) {
    yield put(Creators.getInboxAndUnbox([conversationIDKey]))
  }

  const oldConversationState = yield select(Shared.conversationStateSelector, conversationIDKey)
  if (oldConversationState && oldConversationState.get('isStale') && conversationIDKey) {
    yield put(Creators.clearMessages(conversationIDKey))
  }

  const inbox = yield select(Constants.getInbox, conversationIDKey)
  const inSearch = yield select(inSearchSelector)
  if (inbox && !inbox.teamname) {
    const participants = inbox.get('participants').toArray()
    yield put(Creators.updateMetadata(participants))
    // Update search but don't update the filter
    if (inSearch) {
      const me = yield select(usernameSelector)
      yield put(SearchCreators.setUserInputItems('chatSearch', participants.filter(u => u !== me)))
    }
  }

  if (conversationIDKey) {
    yield put(Creators.loadMoreMessages(conversationIDKey, true, fromUser))
    yield put(navigateTo([conversationIDKey], [chatTab]))
  } else {
    yield put(navigateTo([chatTab]))
  }

  // Do this here because it's possible loadMoreMessages bails early
  // but there are still unread messages that need to be marked as read
  if (fromUser && conversationIDKey) {
    yield put(Creators.updateBadging(conversationIDKey))
    yield put(Creators.updateLatestMessage(conversationIDKey))
  }
}

function* _blockConversation(action: Constants.BlockConversation): SagaGenerator<any, any> {
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

function* _leaveConversation(action: Constants.LeaveConversation): SagaGenerator<any, any> {
  const {conversationIDKey} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  yield call(ChatTypes.localLeaveConversationLocalRpcPromise, {
    param: {convID: conversationID},
  })
}

function* _muteConversation(action: Constants.MuteConversation): SagaGenerator<any, any> {
  const {conversationIDKey, muted} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  const status = muted ? ChatTypes.CommonConversationStatus.muted : ChatTypes.CommonConversationStatus.unfiled
  const identifyBehavior: TLFIdentifyBehavior = TlfKeysTLFIdentifyBehavior.chatGui
  yield call(ChatTypes.localSetConversationStatusLocalRpcPromise, {
    param: {conversationID, identifyBehavior, status},
  })
}

// Keeping this out of the store to avoid races
// Avoid sending mark as read over and over
const _lastMarkedAsRead = {}
function* _markAsRead(
  conversationIDKey: Constants.ConversationIDKey,
  messageID: Constants.MessageID
): SagaGenerator<any, any> {
  if (_lastMarkedAsRead[conversationIDKey] === messageID) {
    return
  }

  const conversationID = Constants.keyToConversationID(conversationIDKey)
  const {msgID} = Constants.parseMessageID(messageID)

  try {
    yield call(ChatTypes.localMarkAsReadLocalRpcPromise, {
      param: {conversationID, msgID},
    })

    _lastMarkedAsRead[conversationIDKey] = messageID
  } catch (err) {
    console.log(`Couldn't mark as read ${conversationIDKey} ${err}`)
  }
}

function _updateBadging(
  {payload: {conversationIDKey}}: Constants.UpdateBadging,
  lastMessageID: ?Constants.MessageID
) {
  // Update gregor's view of the latest message we've read.
  if (conversationIDKey && lastMessageID) {
    return call(_markAsRead, conversationIDKey, lastMessageID)
  }
}

function* _changedFocus(action: ChangedFocus): SagaGenerator<any, any> {
  // Update badging and the latest message due to the refocus.
  const {appFocused} = action.payload
  const conversationIDKey = yield select(Constants.getSelectedConversation)
  const selectedTab = yield select(Shared.routeSelector)
  const chatTabSelected = selectedTab === chatTab
  if (conversationIDKey && chatTabSelected) {
    if (appFocused) {
      yield put(Creators.updateBadging(conversationIDKey))
    } else {
      // Reset the orange line when focus leaves the app.
      yield put(Creators.updateLatestMessage(conversationIDKey))
    }
  }
}

function* _changedActive(action: ChangedActive): SagaGenerator<any, any> {
  // Update badging and the latest message due to changing active state.
  const {userActive} = action.payload
  const appFocused = yield select(Shared.focusedSelector)
  const conversationIDKey = yield select(Constants.getSelectedConversation)
  const selectedTab = yield select(Shared.routeSelector)
  const chatTabSelected = selectedTab === chatTab
  // Only do this if focus is retained - otherwise, focus changing logic prevails
  if (conversationIDKey && chatTabSelected && appFocused) {
    if (userActive) {
      yield put(Creators.updateBadging(conversationIDKey))
    } else {
      // Reset the orange line when becoming inactive
      yield put(Creators.updateLatestMessage(conversationIDKey))
    }
  }
}

function* _badgeAppForChat(action: Constants.BadgeAppForChat): SagaGenerator<any, any> {
  const conversations = action.payload
  let totals: {[key: string]: number} = {}
  let badges: {[key: string]: number} = {}

  conversations.forEach(conv => {
    const total = conv.get('unreadMessages')
    if (total) {
      const badged = conv.get('badgeCounts')[
        `${isMobile ? CommonDeviceType.mobile : CommonDeviceType.desktop}`
      ]
      const conversationIDKey = Constants.conversationIDToKey(conv.get('convID'))
      totals[conversationIDKey] = total
      if (badged) {
        badges[conversationIDKey] = badged
      }
    }
  })

  badges = I.Map(badges)
  totals = I.Map(totals)

  const oldBadge = yield select(s => s.entities.inboxUnreadCountBadge)
  const oldTotal = yield select(s => s.entities.inboxUnreadCountTotal)
  if (!I.is(oldBadge, badges)) {
    yield put(EntityCreators.replaceEntity([], I.Map({inboxUnreadCountBadge: badges})))
  }
  if (!I.is(oldTotal, totals)) {
    yield put(EntityCreators.replaceEntity([], I.Map({inboxUnreadCountTotal: totals})))
  }
}

function* _appendMessagesToConversation({payload: {conversationIDKey, messages}}: Constants.AppendMessages) {
  const currentMessages = yield select(Constants.getConversationMessages, conversationIDKey)
  const nextMessages = currentMessages.concat(messages.map(m => m.key))
  yield put(
    EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))
  )
}

function* _prependMessagesToConversation({payload: {conversationIDKey, messages}}: Constants.AppendMessages) {
  const currentMessages = yield select(Constants.getConversationMessages, conversationIDKey)
  const nextMessages = I.OrderedSet(messages.map(m => m.key)).concat(currentMessages)
  yield put(
    EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))
  )
}

function* _clearConversationMessages({payload: {conversationIDKey}}: Constants.ClearMessages) {
  yield put(
    EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: I.OrderedSet()}))
  )
}

function* _storeMessageToEntity(action: Constants.AppendMessages | Constants.PrependMessages) {
  const newMessages = action.payload.messages
  yield put(EntityCreators.mergeEntity(['messages'], I.Map(newMessages.map(m => [m.key, m]))))
}

function _updateMessageEntity(action: Constants.UpdateTempMessage) {
  if (!action.error) {
    const {payload: {message}} = action
    // You have to wrap this in Map(...) because otherwise the merge will turn message into an immutable struct
    // We use merge instead of replace because otherwise the replace will turn message into an immutable struct
    return put(EntityCreators.mergeEntity(['messages'], I.Map({[message.key]: message})))
  } else {
    console.warn('error in updating temp message', action.payload)
  }
}

function _updateSnippet({payload: {snippet, conversationIDKey}}: Constants.UpdateSnippet) {
  return put(EntityCreators.replaceEntity(['convIDToSnippet'], I.Map({[conversationIDKey]: snippet})))
}

function _removeOutboxMessage(
  {payload: {conversationIDKey, outboxID}}: Constants.RemoveOutboxMessage,
  msgKeys: I.OrderedSet<Constants.MessageKey>
) {
  const nextMessages = msgKeys.filter(k => {
    const {messageID} = Constants.splitMessageIDKey(k)
    return messageID !== outboxID
  })

  if (nextMessages.equals(msgKeys)) {
    return
  }
  return put(
    EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))
  )
}

function* _updateOutboxMessageToReal({
  payload: {oldMessageKey, newMessageKey},
}: Constants.OutboxMessageBecameReal) {
  const localMessageState = yield select(Constants.getLocalMessageStateFromMessageKey, oldMessageKey)
  const conversationIDKey = Constants.messageKeyConversationIDKey(newMessageKey)
  const currentMessages = yield select(Constants.getConversationMessages, conversationIDKey)
  const nextMessages = currentMessages.map(k => (k === oldMessageKey ? newMessageKey : k))
  yield all([
    put(EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))),
    put(
      EntityCreators.mergeEntity(
        [],
        I.Map({
          attachmentDownloadedPath: I.Map({[newMessageKey]: localMessageState.downloadedPath}),
          attachmentPreviewPath: I.Map({[newMessageKey]: localMessageState.previewPath}),
          attachmentPreviewProgress: I.Map({[newMessageKey]: localMessageState.previewProgress}),
          attachmentDownloadProgress: I.Map({[newMessageKey]: localMessageState.downloadProgress}),
          attachmentUploadProgress: I.Map({[newMessageKey]: localMessageState.uploadProgress}),
        })
      )
    ),
  ])
}

function* _findMessagesToDelete(action: Constants.AppendMessages | Constants.PrependMessages) {
  const newMessages = action.payload.messages
  const deletedIDs = []
  const conversationIDKey = action.payload.conversationIDKey
  newMessages.forEach(message => {
    if (message.type === 'Deleted') {
      deletedIDs.push(...message.deletedIDs)
    }
  })

  if (deletedIDs.length) {
    yield put(EntityCreators.mergeEntity(['deletedIDs'], I.Map({[conversationIDKey]: I.Set(deletedIDs)})))
  }
}

function* _findMessageUpdates(action: Constants.AppendMessages | Constants.PrependMessages) {
  const newMessages = action.payload.messages
  type TargetMessageID = string
  const updateIDs: {[key: TargetMessageID]: I.OrderedSet<Constants.MessageKey>} = {}
  const conversationIDKey = action.payload.conversationIDKey
  newMessages.forEach(message => {
    if (message.type === 'Edit' || message.type === 'UpdateAttachment') {
      updateIDs[message.targetMessageID] = I.OrderedSet([message.key])
    }
  })

  if (Object.keys(updateIDs).length) {
    yield put(EntityCreators.mergeEntity(['messageUpdates', conversationIDKey], I.Map(updateIDs)))
  }
}

function* _sendNotifications(action: Constants.AppendMessages): SagaGenerator<any, any> {
  const appFocused = yield select(Shared.focusedSelector)
  const selectedTab = yield select(Shared.routeSelector)
  const chatTabSelected = selectedTab === chatTab
  const convoIsSelected = action.payload.isSelected
  const svcDisplay = action.payload.svcShouldDisplayNotification

  console.log(
    'Deciding whether to notify new message:',
    svcDisplay,
    convoIsSelected,
    appFocused,
    chatTabSelected
  )
  // Only send if you're not looking at it and service wants us to
  if (svcDisplay && (!convoIsSelected || !appFocused || !chatTabSelected)) {
    const me = yield select(usernameSelector)
    const message = action.payload.messages.reverse().find(m => m.type === 'Text' && m.author !== me)
    // Is this message part of a muted conversation? If so don't notify.
    const convo = yield select(Constants.getInbox, action.payload.conversationIDKey)
    if (convo && convo.get('status') !== 'muted') {
      if (message && message.type === 'Text') {
        console.log('Sending Chat notification')
        const snippet = Constants.makeSnippet(Constants.serverMessageToMessageText(message))
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

function* _markThreadsStale(action: Constants.MarkThreadsStale): SagaGenerator<any, any> {
  // Load inbox items of any stale items so we get update on rekeyInfos, etc
  const {updates} = action.payload
  const convIDs = updates.map(u => Constants.conversationIDToKey(u.convID))
  yield put(Creators.unboxConversations(convIDs, 'thread stale', true))

  // Selected is stale?
  const selectedConversation = yield select(Constants.getSelectedConversation)
  if (!selectedConversation) {
    return
  }
  yield put(Creators.clearMessages(selectedConversation))
  yield put(Creators.loadMoreMessages(selectedConversation, false))
}

function* _inboxSynced(action: Constants.InboxSynced): SagaGenerator<any, any> {
  const {convs} = action.payload
  const author = yield select(usernameSelector)
  const items = Shared.makeInboxStateRecords(author, convs, I.Map())

  yield put(
    EntityCreators.replaceEntity(
      ['inbox'],
      I.Map(
        items.reduce((map, c) => {
          map[c.conversationIDKey] = c
          return map
        }, {})
      )
    )
  )
  const convIDs = items.map(item => item.conversationIDKey)
  yield put(Creators.unboxConversations(convIDs, 'inbox syncing', true, true))

  const selectedConversation = yield select(Constants.getSelectedConversation)
  if (!selectedConversation || convIDs.indexOf(selectedConversation) < 0) {
    return
  }

  const conversation = yield select(Constants.getSelectedConversationStates)
  if (conversation) {
    const inbox = yield select(Constants.getInbox, selectedConversation)

    const messageKeys = yield select(Constants.getConversationMessages, selectedConversation)
    const lastMessageKey = messageKeys.last()
    let numberOverride
    if (lastMessageKey) {
      const lastMessage = yield select(Constants.getMessageFromMessageKey, lastMessageKey)
      // Check to see if we could possibly be asking for too many messages
      if (lastMessage && lastMessage.rawMessageID && inbox && inbox.maxMsgID) {
        numberOverride = inbox.maxMsgID - lastMessage.rawMessageID

        if (numberOverride > tooManyMessagesToJustAppendOnStale) {
          console.log(
            'Doing a full load due to too many old messages',
            inbox.maxMsgID - lastMessage.rawMessageID
          )
          yield all([
            put(Creators.clearMessages(selectedConversation)),
            yield put(Creators.loadMoreMessages(selectedConversation, false)),
          ])
          return
        }
      }
    }
    // It is VERY important to pass the exact number of things to request here. The pagination system will
    // return whatever number we ask for on newest messages due to its architecture so if we want only N
    // newer items we have to explictly ask for N or it will give us messages older than onyNewerThan
    yield put(Creators.loadMoreMessages(selectedConversation, false, false, true, numberOverride))
  }
}

function _threadIsCleared(originalAction: Action, checkAction: Action): boolean {
  return (
    originalAction.type === 'chat:loadMoreMessages' &&
    checkAction.type === 'chat:clearMessages' &&
    originalAction.payload.conversationIDKey === checkAction.payload.conversationIDKey
  )
}

function* _openConversation({
  payload: {conversationIDKey},
}: Constants.OpenConversation): SagaGenerator<any, any> {
  yield put(Creators.selectConversation(conversationIDKey, false))
}

function* _updateTyping({
  payload: {conversationIDKey, typing},
}: Constants.UpdateTyping): SagaGenerator<any, any> {
  // Send we-are-typing info up to Gregor.
  if (!Constants.isPendingConversationIDKey(conversationIDKey)) {
    const conversationID = Constants.keyToConversationID(conversationIDKey)
    yield call(ChatTypes.localUpdateTypingRpcPromise, {
      param: {conversationID, typing},
    })
  }
}

// TODO this is kinda confusing. I think there is duplicated state...
function* _updateTempSearchConversation(action: SearchConstants.UserInputItemsUpdated) {
  const {payload: {userInputItemIds}} = action
  const [me, inSearch] = yield all([select(usernameSelector), select(inSearchSelector)])

  if (!inSearch) {
    return
  }

  const actionsToPut = [put(Creators.removeTempPendingConversations())]
  if (userInputItemIds.length) {
    actionsToPut.push(put(Creators.startConversation(userInputItemIds.concat(me), false, true)))
  } else {
    actionsToPut.push(put(Creators.selectConversation(null, false)))
    actionsToPut.push(put(SearchCreators.searchSuggestions('chatSearch')))
  }

  // Always clear the search results when you select/unselect
  actionsToPut.push(put(SearchCreators.clearSearchResults('chatSearch')))
  yield all(actionsToPut)
}

function _exitSearch(
  {payload: {skipSelectPreviousConversation}}: Constants.ExitSearch,
  [userInputItemIds, previousConversation]: [
    ReturnValue<typeof SearchConstants.getUserInputItemIds>,
    ReturnValue<typeof previousConversationSelector>,
  ]
) {
  return all([
    put(SearchCreators.clearSearchResults('chatSearch')),
    put(SearchCreators.setUserInputItems('chatSearch', [])),
    put(Creators.removeTempPendingConversations()),
    userInputItemIds.length === 0 && !skipSelectPreviousConversation
      ? put(Creators.selectConversation(previousConversation, false))
      : null,
  ])
}

const _setNotifications = function*(
  action:
    | Constants.SetNotifications
    | Constants.ToggleChannelWideNotifications
    | Constants.UpdatedNotifications
) {
  const {payload: {conversationIDKey}} = action

  // update the one in the store
  const old = yield select(s => s.entities.inbox.get(conversationIDKey))
  if (old) {
    let nextNotifications = {}

    if (action.type === 'chat:setNotifications') {
      const {payload: {deviceType, notifyType}} = action

      // This is the flip-side of the logic in the notifications container.
      if (old.notifications && old.notifications[deviceType]) {
        nextNotifications = {[deviceType]: {}}
        switch (notifyType) {
          case 'generic':
            nextNotifications[deviceType].generic = true
            nextNotifications[deviceType].atmention = true
            break
          case 'atmention':
            nextNotifications[deviceType].generic = false
            nextNotifications[deviceType].atmention = true
            break
          case 'never':
            nextNotifications[deviceType].generic = false
            nextNotifications[deviceType].atmention = false
            break
        }
      }
    } else if (action.type === 'chat:toggleChannelWideNotifications') {
      nextNotifications = {channelWide: !old.notifications.channelWide}
    } else if (action.type === 'chat:updatedNotifications') {
      nextNotifications = action.payload.notifications
    }

    yield put.resolve(
      EntityCreators.replaceEntity(
        ['inbox', conversationIDKey],
        old.set('notifications', {
          ...old.notifications,
          ...nextNotifications,
        })
      )
    )
  }

  // Send out the update if we made it
  if (action.type !== 'chat:updatedNotifications') {
    const inbox = yield select(Constants.getInbox, conversationIDKey)
    if (inbox && inbox.notifications) {
      const {notifications} = inbox
      const param = {
        convID: Constants.keyToConversationID(conversationIDKey),
        channelWide: notifications.channelWide,
        settings: [
          {
            deviceType: CommonDeviceType.desktop,
            kind: ChatTypes.CommonNotificationKind.atmention,
            enabled: notifications.desktop.atmention,
          },
          {
            deviceType: CommonDeviceType.desktop,
            kind: ChatTypes.CommonNotificationKind.generic,
            enabled: notifications.desktop.generic,
          },
          {
            deviceType: CommonDeviceType.mobile,
            kind: ChatTypes.CommonNotificationKind.atmention,
            enabled: notifications.mobile.atmention,
          },
          {
            deviceType: CommonDeviceType.mobile,
            kind: ChatTypes.CommonNotificationKind.generic,
            enabled: notifications.mobile.generic,
          },
        ],
      }
      yield call(ChatTypes.localSetAppNotificationSettingsLocalRpcPromise, {param})
    }
  }
}

function updateProgress(action: Constants.DownloadProgress | Constants.UploadProgress) {
  const {type, payload: {progress, messageKey}} = action
  if (type === 'chat:downloadProgress') {
    if (action.payload.isPreview) {
      return put(EntityCreators.replaceEntity(['attachmentPreviewProgress'], I.Map({[messageKey]: progress})))
    }
    return put(EntityCreators.replaceEntity(['attachmentDownloadProgress'], I.Map({[messageKey]: progress})))
  }
  return put(EntityCreators.replaceEntity(['attachmentUploadProgress'], I.Map({[messageKey]: progress})))
}

function updateAttachmentSavePath(
  action: Constants.AttachmentSaveStart | Constants.AttachmentSaveFailed | Constants.AttachmentSaved
) {
  const {messageKey} = action.payload
  switch (action.type) {
    case 'chat:attachmentSaveFailed':
    case 'chat:attachmentSaveStart':
      return put(EntityCreators.replaceEntity(['attachmentSavedPath'], I.Map({[messageKey]: null})))
    case 'chat:attachmentSaved':
      const {path} = action.payload
      return put(EntityCreators.replaceEntity(['attachmentSavedPath'], I.Map({[messageKey]: path})))
  }
}

function attachmentLoaded(action: Constants.AttachmentLoaded) {
  const {payload: {messageKey, path, isPreview}} = action
  if (isPreview) {
    return all([
      put(EntityCreators.replaceEntity(['attachmentPreviewPath'], I.Map({[messageKey]: path}))),
      put(EntityCreators.replaceEntity(['attachmentPreviewProgress'], I.Map({[messageKey]: null}))),
    ])
  }
  return all([
    put(EntityCreators.replaceEntity(['attachmentDownloadedPath'], I.Map({[messageKey]: path}))),
    put(EntityCreators.replaceEntity(['attachmentDownloadProgress'], I.Map({[messageKey]: null}))),
  ])
}

function* chatSaga(): SagaGenerator<any, any> {
  yield Saga.safeTakeEvery('app:changedFocus', _changedFocus)
  yield Saga.safeTakeEvery('app:changedActive', _changedActive)
  yield Saga.safeTakeEvery('chat:appendMessages', _sendNotifications)
  yield Saga.safeTakeEvery('chat:clearMessages', _clearConversationMessages)
  yield Saga.safeTakeEvery(['chat:appendMessages', 'chat:prependMessages'], _storeMessageToEntity)
  yield Saga.safeTakeEvery(['chat:appendMessages', 'chat:prependMessages'], _findMessagesToDelete)
  yield Saga.safeTakeEvery(['chat:appendMessages', 'chat:prependMessages'], _findMessageUpdates)
  yield Saga.safeTakeEveryPure('chat:attachmentLoaded', attachmentLoaded)
  yield Saga.safeTakeEveryPure(['chat:downloadProgress', 'chat:uploadProgress'], updateProgress)
  yield Saga.safeTakeEveryPure(
    ['chat:attachmentSaveStart', 'chat:attachmentSaveFailed', 'chat:attachmentSaved'],
    updateAttachmentSavePath
  )
  yield Saga.safeTakeEveryPure('chat:updateSnippet', _updateSnippet)
  yield Saga.safeTakeEveryPure(
    'chat:removeOutboxMessage',
    _removeOutboxMessage,
    (s: TypedState, a: Constants.RemoveOutboxMessage) =>
      Constants.getConversationMessages(s, a.payload.conversationIDKey)
  )
  yield Saga.safeTakeEveryPure('chat:updateTempMessage', _updateMessageEntity)
  yield Saga.safeTakeEvery('chat:appendMessages', _appendMessagesToConversation)
  yield Saga.safeTakeEvery('chat:prependMessages', _prependMessagesToConversation)
  yield Saga.safeTakeEvery('chat:outboxMessageBecameReal', _updateOutboxMessageToReal)
  yield Saga.safeTakeEvery('chat:blockConversation', _blockConversation)
  yield Saga.safeTakeEvery('chat:deleteMessage', Messages.deleteMessage)
  yield Saga.safeTakeEvery('chat:editMessage', Messages.editMessage)
  yield Saga.safeTakeEvery('chat:getInboxAndUnbox', Inbox.onGetInboxAndUnbox)
  yield Saga.safeTakeEvery('chat:incomingMessage', _incomingMessage)
  yield Saga.safeTakeEvery('chat:incomingTyping', _incomingTyping)
  yield Saga.safeTakeEvery('chat:leaveConversation', _leaveConversation)
  yield Saga.safeTakeSerially('chat:loadAttachment', Attachment.onLoadAttachment)
  yield Saga.safeTakeEvery('chat:loadAttachmentPreview', Attachment.onLoadAttachmentPreview)
  yield Saga.safeTakeEvery('chat:loadMoreMessages', Saga.cancelWhen(_threadIsCleared, _loadMoreMessages))
  yield Saga.safeTakeEvery('chat:markThreadsStale', _markThreadsStale)
  yield Saga.safeTakeEvery('chat:inboxSynced', _inboxSynced)
  yield Saga.safeTakeEvery('chat:muteConversation', _muteConversation)
  yield Saga.safeTakeEvery('chat:newChat', _newChat)
  yield Saga.safeTakeEvery('chat:openAttachmentPopup', Attachment.onOpenAttachmentPopup)
  yield Saga.safeTakeEvery('chat:openConversation', _openConversation)
  yield Saga.safeTakeEvery('chat:openFolder', _openFolder)
  yield Saga.safeTakeEvery('chat:openTlfInChat', _openTlfInChat)
  yield Saga.safeTakeEvery('chat:postMessage', Messages.postMessage)
  yield Saga.safeTakeEvery('chat:retryAttachment', Attachment.onRetryAttachment)
  yield Saga.safeTakeEvery('chat:retryMessage', Messages.retryMessage)
  yield Saga.safeTakeEvery('chat:saveAttachment', Attachment.onSaveAttachment)
  yield Saga.safeTakeEvery('chat:saveAttachmentNative', Attachment.onSaveAttachmentNative)
  yield Saga.safeTakeEvery('chat:selectAttachment', Attachment.onSelectAttachment)
  yield Saga.safeTakeEvery('chat:setupChatHandlers', _setupChatHandlers)
  yield Saga.safeTakeEvery('chat:shareAttachment', Attachment.onShareAttachment)
  yield Saga.safeTakeEvery('chat:startConversation', _startConversation)
  yield Saga.safeTakeEveryPure(
    'chat:updateBadging',
    _updateBadging,
    (state: TypedState, {payload: {conversationIDKey}}: Constants.UpdateBadging) =>
      Constants.lastMessageID(state, conversationIDKey)
  )
  yield Saga.safeTakeEvery('chat:updateMetadata', _updateMetadata)
  yield Saga.safeTakeEvery('chat:updateTyping', _updateTyping)
  yield Saga.safeTakeEvery('chat:updateThread', _updateThread)
  yield Saga.safeTakeLatest('chat:badgeAppForChat', _badgeAppForChat)
  yield Saga.safeTakeLatest(['chat:loadInbox'], Inbox.onInboxLoad)
  yield Saga.safeTakeLatest(['chat:inboxStale'], Inbox.onInboxStale)
  yield Saga.safeTakeLatest('chat:selectConversation', _selectConversation)
  yield Saga.safeTakeLatest(
    SearchConstants.isUserInputItemsUpdated('chatSearch'),
    _updateTempSearchConversation
  )
  yield Saga.safeTakeEveryPure('chat:exitSearch', _exitSearch, s => [
    SearchConstants.getUserInputItemIds(s, {searchKey: 'chatSearch'}),
    previousConversationSelector(s),
  ])
  yield Saga.safeTakeEvery(
    ['chat:setNotifications', 'chat:updatedNotifications', 'chat:toggleChannelWideNotifications'],
    _setNotifications
  )
  yield Saga.safeTakeSerially('chat:unboxConversations', Inbox.unboxConversations)
  yield Saga.safeTakeLatest('chat:unboxMore', Inbox.unboxMore)
  yield Saga.safeTakeEvery('chat:inboxFilterSelectNext', Inbox.filterSelectNext)
}

export default chatSaga

export {badgeAppForChat, openTlfInChat, setupChatHandlers, startConversation} from './creators'
