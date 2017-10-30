// @flow
// Actions that have to do with a single thread
// Loading messages, clearing messages, appending, prepending, dealing with incoming
//
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as Creators from './creators'
import * as EngineRpc from '../engine/helper'
import * as EntityCreators from '../entities'
import * as I from 'immutable'
import * as Inbox from './inbox'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Selectors from '../../constants/selectors'
import * as Shared from './shared'
import HiddenString from '../../util/hidden-string'
import {chatTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {toDeviceType} from '../../constants/types/more'
import {type Action} from '../../constants/types/flux'
import {type TypedState} from '../../constants/reducer'
import {type ChangedFocus, type ChangedActive} from '../../constants/app'

function* _clearConversationMessages({payload: {conversationIDKey}}: Constants.ClearMessages) {
  yield Saga.put(
    EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: I.OrderedSet()}))
  )
}

function* _storeMessageToEntity(action: Constants.AppendMessages | Constants.PrependMessages) {
  const newMessages = action.payload.messages
  yield Saga.put(EntityCreators.mergeEntity(['messages'], I.Map(newMessages.map(m => [m.key, m]))))
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
    yield Saga.put(
      EntityCreators.mergeEntity(['deletedIDs'], I.Map({[conversationIDKey]: I.Set(deletedIDs)}))
    )
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
    yield Saga.put(EntityCreators.mergeEntity(['messageUpdates', conversationIDKey], I.Map(updateIDs)))
  }
}

function _threadIsCleared(originalAction: Action, checkAction: Action): boolean {
  return (
    originalAction.type === 'chat:loadMoreMessages' &&
    checkAction.type === 'chat:clearMessages' &&
    originalAction.payload.conversationIDKey === checkAction.payload.conversationIDKey
  )
}

function* _loadMoreMessages(action: Constants.LoadMoreMessages): Saga.SagaGenerator<any, any> {
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

    const untrustedState = yield Saga.select(state =>
      state.entities.inboxUntrustedState.get(conversationIDKey)
    )

    // only load unboxed things
    if (!['unboxed', 'reUnboxing'].includes(untrustedState)) {
      console.log('Bailing on not yet unboxed conversation', untrustedState)
      return
    }

    const rekeyInfoSelector = (state: TypedState, conversationIDKey: Constants.ConversationIDKey) => {
      return state.chat.get('rekeyInfos').get(conversationIDKey)
    }
    const rekeyInfo = yield Saga.select(rekeyInfoSelector, conversationIDKey)

    if (rekeyInfo) {
      console.log('Bailing on chat due to rekey info')
      return
    }

    const oldConversationState = yield Saga.select(Shared.conversationStateSelector, conversationIDKey)
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

    yield Saga.put(Creators.loadingMessages(conversationIDKey, true))

    const yourName = yield Saga.select(Selectors.usernameSelector)
    const yourDeviceName = yield Saga.select(Shared.devicenameSelector)

    // We receive the list with edit/delete/etc already applied so lets filter that out
    const messageTypes = Object.keys(ChatTypes.CommonMessageType)
      .filter(k => !['edit', 'delete', 'headline', 'attachmentuploaded'].includes(k))
      .map(k => ChatTypes.CommonMessageType[k])
    const conversationID = Constants.keyToConversationID(conversationIDKey)

    const messageKeys = yield Saga.select(Constants.getConversationMessages, conversationIDKey)
    // Find a real message id (ignore outbox etc)
    let pivotMessageKey = recent
      ? messageKeys.findLast(Constants.messageKeyKindIsMessageID)
      : messageKeys.find(Constants.messageKeyKindIsMessageID)

    let pivot
    if (pivotMessageKey) {
      const message = yield Saga.select(Constants.getMessageFromMessageKey, pivotMessageKey)
      pivot = message ? message.rawMessageID : null
    }

    const loadThreadChanMapRpc = new EngineRpc.EngineRpcCall(
      getThreadNonblockSagaMap(yourName, yourDeviceName, conversationIDKey, recent),
      ChatTypes.localGetThreadNonblockRpcChannelMap,
      'localGetThreadNonblock',
      {
        param: {
          conversationID,
          identifyBehavior: RPCTypes.TlfKeysTLFIdentifyBehavior.chatGui,
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

    const result = yield Saga.call(loadThreadChanMapRpc.run)

    if (EngineRpc.isFinished(result)) {
      const {payload: {params, error}} = result

      if (error) {
        console.warn('error in localGetThreadNonblock', error)
      }

      if (params.offline) {
        yield Saga.put(Creators.threadLoadedOffline(conversationIDKey))
      }

      yield Saga.put(Creators.setLoaded(conversationIDKey, !error)) // reset isLoaded on error
    } else {
      console.warn('localGetThreadNonblock rpc bailed early')
    }

    // Do this here because it's possible loading messages takes a while
    // If this is the selected conversation and this was a result of user action
    // We can assume the messages we've loaded have been seen.
    const selectedConversationIDKey = yield Saga.select(Constants.getSelectedConversation)
    if (selectedConversationIDKey === conversationIDKey && action.payload.fromUser) {
      yield Saga.put(Creators.updateBadging(conversationIDKey))
      yield Saga.put(Creators.updateLatestMessage(conversationIDKey))
    }
  } finally {
    yield Saga.put(Creators.loadingMessages(conversationIDKey, false))
  }
}

function subSagaUpdateThread(yourName, yourDeviceName, conversationIDKey, append) {
  return function* subSagaUpdateThreadHelper({thread}) {
    if (thread) {
      const decThread: ChatTypes.UIMessages = JSON.parse(thread)
      yield Saga.put(Creators.updateThread(decThread, yourName, yourDeviceName, conversationIDKey, append))
    }
    return EngineRpc.rpcResult()
  }
}

const getThreadNonblockSagaMap = (yourName, yourDeviceName, conversationIDKey, append) => ({
  'chat.1.chatUi.chatThreadCached': subSagaUpdateThread(yourName, yourDeviceName, conversationIDKey, append),
  'chat.1.chatUi.chatThreadFull': subSagaUpdateThread(yourName, yourDeviceName, conversationIDKey, append),
})

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

function* _incomingMessage(action: Constants.IncomingMessage): Saga.SagaGenerator<any, any> {
  switch (action.payload.activity.activityType) {
    case ChatTypes.NotifyChatChatActivityType.setStatus:
      const setStatus: ?ChatTypes.SetStatusInfo = action.payload.activity.setStatus
      if (setStatus) {
        yield Saga.call(Inbox.processConversation, setStatus.conv)
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
          const isConversationLoaded = yield Saga.select(Shared.conversationStateSelector, conversationIDKey)
          if (!isConversationLoaded) return

          const pendingMessage = yield Saga.select(
            Shared.messageOutboxIDSelector,
            conversationIDKey,
            outboxID
          )
          if (pendingMessage) {
            yield Saga.put(
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
          yield Saga.call(Inbox.processConversation, inboxUIItem)
        }
      }
      return
    case ChatTypes.NotifyChatChatActivityType.incomingMessage:
      const incomingMessage: ?ChatTypes.IncomingMessage = action.payload.activity.incomingMessage
      if (incomingMessage) {
        // If it's a public chat, the GUI (currently) wants no part of it. We
        // especially don't want to surface the conversation as if it were a
        // private one, which is what we were doing before this change.
        if (
          incomingMessage.conv &&
          incomingMessage.conv.visibility !== RPCTypes.CommonTLFVisibility.private
        ) {
          return
        }

        const conversationIDKey = Constants.conversationIDToKey(incomingMessage.convID)
        if (incomingMessage.conv) {
          yield Saga.call(Inbox.processConversation, incomingMessage.conv)
        } else {
          // Sometimes (just for deletes?) we get an incomingMessage without
          // a conv object -- in that case, ask the service to give us an
          // updated one so that the snippet etc gets updated.
          yield Saga.put(
            Creators.unboxConversations([conversationIDKey], 'no conv from incoming message', true)
          )
        }

        const messageUnboxed: ChatTypes.UIMessage = incomingMessage.message
        const yourName = yield Saga.select(Selectors.usernameSelector)
        const yourDeviceName = yield Saga.select(Shared.devicenameSelector)
        const message = _unboxedToMessage(messageUnboxed, yourName, yourDeviceName, conversationIDKey)
        if (message.type === 'Unhandled') {
          return
        }
        const svcShouldDisplayNotification = incomingMessage.displayDesktopNotification

        // Is this message for the currently selected and focused conversation?
        // And is the Chat tab the currently displayed route? If all that is
        // true, mark it as read ASAP to avoid badging it -- we don't need to
        // badge, the user's looking at it already.  Also mark as read ASAP if
        // it was written by the current user.
        const selectedConversationIDKey = yield Saga.select(Constants.getSelectedConversation)
        const appFocused = yield Saga.select(Shared.focusedSelector)
        const userActive = yield Saga.select(Shared.activeSelector)
        const selectedTab = yield Saga.select(Shared.routeSelector)
        const chatTabSelected = selectedTab === chatTab
        const conversationIsFocused =
          conversationIDKey === selectedConversationIDKey && appFocused && chatTabSelected && userActive
        const {type: msgIDType} = Constants.parseMessageID(message.messageID)

        if (message && message.messageID && conversationIsFocused && msgIDType === 'rpcMessageID') {
          yield Saga.call(_markAsRead, conversationIDKey, message.messageID)
        }

        const messageFromYou =
          message.deviceName === yourDeviceName && message.author && yourName === message.author

        let pendingMessage
        if (
          (message.type === 'Text' || message.type === 'Attachment') &&
          messageFromYou &&
          message.outboxID
        ) {
          pendingMessage = yield Saga.select(
            Shared.messageOutboxIDSelector,
            conversationIDKey,
            message.outboxID
          )
        }

        if (pendingMessage) {
          yield Saga.all([
            // If the message has an outboxID and came from our device, then we
            // sent it and have already rendered it in the message list; we just
            // need to mark it as sent.
            Saga.put(Creators.updateTempMessage(conversationIDKey, message, message.outboxID)),
            Saga.put(Creators.outboxMessageBecameReal(pendingMessage.key, message.key)),
          ])

          const messageID = message.messageID
          if (messageID) {
            yield Saga.put(
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
          yield Saga.put(
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
      break
    case ChatTypes.NotifyChatChatActivityType.setAppNotificationSettings:
      if (action.payload.activity && action.payload.activity.setAppNotificationSettings) {
        const {convID, settings} = action.payload.activity.setAppNotificationSettings
        if (convID && settings) {
          const conversationIDKey = Constants.conversationIDToKey(convID)
          const notifications = Inbox.parseNotifications(settings)
          if (notifications) {
            yield Saga.put(Creators.updatedNotifications(conversationIDKey, notifications))
          }
        }
      }
      break
    case ChatTypes.NotifyChatChatActivityType.teamtype:
      // Just reload everything if we get one of these
      yield Saga.put(Creators.inboxStale('team type changed'))
      break
    case ChatTypes.NotifyChatChatActivityType.newConversation:
      const newConv: ?ChatTypes.NewConversationInfo = action.payload.activity.newConversation
      if (newConv && newConv.conv) {
        yield Saga.call(Inbox.processConversation, newConv.conv)
        break
      }
      // Just reload everything if we get this with no InboxUIItem
      console.log('newConversation with no InboxUIItem')
      yield Saga.put(Creators.inboxStale('no inbox item for new conv message'))
      break
    default:
      console.warn(
        'Unsupported incoming message type for Chat of type:',
        action.payload.activity.activityType
      )
  }
}

// used to key errors. Negative so that we know we made this up and didn't get it from the server
let errorIdx = -1

function _unboxedToMessage(
  message: ChatTypes.UIMessage,
  yourName,
  yourDeviceName,
  conversationIDKey: Constants.ConversationIDKey
): Constants.Message {
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
      conversationIDKey,
      deviceName: yourDeviceName,
      deviceType: isMobile ? 'mobile' : 'desktop',
      editedCount: 0,
      failureDescription,
      key: Constants.messageKey(conversationIDKey, 'outboxIDText', outboxIDKey),
      message: new HiddenString((messageText && messageText.body) || ''),
      messageState,
      outboxID: outboxIDKey,
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
            : 0
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
            ...common,
            editedCount: 0,
            message,
            messageState: 'sent', // TODO, distinguish sent/pending once CORE sends it.
            key: Constants.messageKey(common.conversationIDKey, 'system', common.messageID),
          }
        }
        case ChatTypes.CommonMessageType.leave: {
          const message = new HiddenString('left')
          return {
            type: 'System',
            ...common,
            editedCount: 0,
            message,
            messageState: 'sent', // TODO, distinguish sent/pending once CORE sends it.
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

// Keeping this out of the store to avoid races
// Avoid sending mark as read over and over
const _lastMarkedAsRead = {}
function* _markAsRead(
  conversationIDKey: Constants.ConversationIDKey,
  messageID: Constants.MessageID
): Saga.SagaGenerator<any, any> {
  if (_lastMarkedAsRead[conversationIDKey] === messageID) {
    return
  }

  const conversationID = Constants.keyToConversationID(conversationIDKey)
  const {msgID} = Constants.parseMessageID(messageID)

  try {
    yield Saga.call(ChatTypes.localMarkAsReadLocalRpcPromise, {
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
    return Saga.call(_markAsRead, conversationIDKey, lastMessageID)
  }
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

function* _updateThread({
  payload: {yourName, thread, yourDeviceName, conversationIDKey, append},
}: Constants.UpdateThread) {
  let newMessages = []
  const newUnboxeds = (thread && thread.messages) || []
  for (const unboxed of newUnboxeds) {
    const message = _unboxedToMessage(unboxed, yourName, yourDeviceName, conversationIDKey)
    const messageFromYou =
      message.deviceName === yourDeviceName && message.author && yourName === message.author

    let pendingMessage
    if ((message.type === 'Text' || message.type === 'Attachment') && messageFromYou && message.outboxID) {
      pendingMessage = yield Saga.select(Shared.messageOutboxIDSelector, conversationIDKey, message.outboxID)
    }

    if (pendingMessage) {
      // Delete the pre-existing pending version of this message, since we're
      // about to add a newly received version of the same message.
      yield Saga.put(Creators.removeOutboxMessage(conversationIDKey, message.outboxID))
    }

    if (message.type !== 'Unhandled') {
      newMessages.push(message)
    }
  }

  newMessages = newMessages.reverse()
  if (append) {
    const selectedConversationIDKey = yield Saga.select(Constants.getSelectedConversation)
    const appFocused = yield Saga.select(Shared.focusedSelector)

    yield Saga.put(
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
    yield Saga.put(Creators.prependMessages(conversationIDKey, newMessages, !last))
  }
}

function* _appendMessagesToConversation({payload: {conversationIDKey, messages}}: Constants.AppendMessages) {
  const currentMessages = yield Saga.select(Constants.getConversationMessages, conversationIDKey)
  const nextMessages = currentMessages.concat(messages.map(m => m.key))
  yield Saga.put(
    EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))
  )
}

function* _prependMessagesToConversation({payload: {conversationIDKey, messages}}: Constants.AppendMessages) {
  const currentMessages = yield Saga.select(Constants.getConversationMessages, conversationIDKey)
  const nextMessages = I.OrderedSet(messages.map(m => m.key)).concat(currentMessages)
  yield Saga.put(
    EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))
  )
}

function _updateMessageEntity(action: Constants.UpdateTempMessage) {
  if (!action.error) {
    const {payload: {message}} = action
    // You have to wrap this in Map(...) because otherwise the merge will turn message into an immutable struct
    // We use merge instead of replace because otherwise the replace will turn message into an immutable struct
    return Saga.put(EntityCreators.mergeEntity(['messages'], I.Map({[message.key]: message})))
  } else {
    console.warn('error in updating temp message', action.payload)
  }
}

function* _openConversation({
  payload: {conversationIDKey},
}: Constants.OpenConversation): Saga.SagaGenerator<any, any> {
  yield Saga.put(Creators.selectConversation(conversationIDKey, false))
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
  return Saga.put(
    EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))
  )
}

function* _updateOutboxMessageToReal({
  payload: {oldMessageKey, newMessageKey},
}: Constants.OutboxMessageBecameReal) {
  const localMessageState = yield Saga.select(Constants.getLocalMessageStateFromMessageKey, oldMessageKey)
  const conversationIDKey = Constants.messageKeyConversationIDKey(newMessageKey)
  const currentMessages = yield Saga.select(Constants.getConversationMessages, conversationIDKey)
  const nextMessages = currentMessages.map(k => (k === oldMessageKey ? newMessageKey : k))
  yield Saga.all([
    Saga.put(
      EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))
    ),
    Saga.put(
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

function* _updateMetadata(action: Constants.UpdateMetadata): Saga.SagaGenerator<any, any> {
  // Don't send sharing before signup values
  const metaData = yield Saga.select(Shared.metaDataSelector)
  const usernames = action.payload.users.filter(
    name =>
      metaData.getIn([name, 'fullname']) === undefined && name.indexOf('@') === -1 && name.indexOf('#') === -1
  )
  if (!usernames.length) {
    return
  }

  try {
    const results: any = yield Saga.call(RPCTypes.apiserverGetRpcPromise, {
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

    yield Saga.put(Creators.updatedMetadata(payload))
  } catch (err) {
    if (err && err.code === RPCTypes.ConstantsStatusCode.scapinetworkerror) {
      // Ignore api errors due to offline
    } else {
      throw err
    }
  }
}

function* _changedActive(action: ChangedActive): Saga.SagaGenerator<any, any> {
  // Update badging and the latest message due to changing active state.
  const {userActive} = action.payload
  const appFocused = yield Saga.select(Shared.focusedSelector)
  const conversationIDKey = yield Saga.select(Constants.getSelectedConversation)
  const selectedTab = yield Saga.select(Shared.routeSelector)
  const chatTabSelected = selectedTab === chatTab
  // Only do this if focus is retained - otherwise, focus changing logic prevails
  if (conversationIDKey && chatTabSelected && appFocused) {
    if (userActive) {
      yield Saga.put(Creators.updateBadging(conversationIDKey))
    } else {
      // Reset the orange line when becoming inactive
      yield Saga.put(Creators.updateLatestMessage(conversationIDKey))
    }
  }
}

function* _updateTyping({
  payload: {conversationIDKey, typing},
}: Constants.UpdateTyping): Saga.SagaGenerator<any, any> {
  // Send we-are-typing info up to Gregor.
  if (!Constants.isPendingConversationIDKey(conversationIDKey)) {
    const conversationID = Constants.keyToConversationID(conversationIDKey)
    yield Saga.call(ChatTypes.localUpdateTypingRpcPromise, {
      param: {conversationID, typing},
    })
  }
}

function* _changedFocus(action: ChangedFocus): Saga.SagaGenerator<any, any> {
  // Update badging and the latest message due to the refocus.
  const {appFocused} = action.payload
  const conversationIDKey = yield Saga.select(Constants.getSelectedConversation)
  const selectedTab = yield Saga.select(Shared.routeSelector)
  const chatTabSelected = selectedTab === chatTab
  if (conversationIDKey && chatTabSelected) {
    if (appFocused) {
      yield Saga.put(Creators.updateBadging(conversationIDKey))
    } else {
      // Reset the orange line when focus leaves the app.
      yield Saga.put(Creators.updateLatestMessage(conversationIDKey))
    }
  }
}

function* registerSagas(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery('app:changedActive', _changedActive)
  yield Saga.safeTakeEvery('chat:clearMessages', _clearConversationMessages)
  yield Saga.safeTakeEvery(['chat:appendMessages', 'chat:prependMessages'], _storeMessageToEntity)
  yield Saga.safeTakeEvery(['chat:appendMessages', 'chat:prependMessages'], _findMessagesToDelete)
  yield Saga.safeTakeEvery(['chat:appendMessages', 'chat:prependMessages'], _findMessageUpdates)
  yield Saga.safeTakeEvery('chat:loadMoreMessages', Saga.cancelWhen(_threadIsCleared, _loadMoreMessages))
  yield Saga.safeTakeEvery('chat:incomingMessage', _incomingMessage)
  yield Saga.safeTakeEvery('chat:updateThread', _updateThread)
  yield Saga.safeTakeEveryPure(
    'chat:updateBadging',
    _updateBadging,
    (state: TypedState, {payload: {conversationIDKey}}: Constants.UpdateBadging) =>
      Constants.lastMessageID(state, conversationIDKey)
  )
  yield Saga.safeTakeEveryPure('chat:updateTempMessage', _updateMessageEntity)
  yield Saga.safeTakeEvery('chat:appendMessages', _appendMessagesToConversation)
  yield Saga.safeTakeEvery('chat:prependMessages', _prependMessagesToConversation)
  yield Saga.safeTakeEveryPure(
    'chat:removeOutboxMessage',
    _removeOutboxMessage,
    (s: TypedState, a: Constants.RemoveOutboxMessage) =>
      Constants.getConversationMessages(s, a.payload.conversationIDKey)
  )
  yield Saga.safeTakeEvery('chat:outboxMessageBecameReal', _updateOutboxMessageToReal)
  yield Saga.safeTakeEvery('chat:openConversation', _openConversation)
  yield Saga.safeTakeEvery('chat:updateMetadata', _updateMetadata)
  yield Saga.safeTakeEvery('chat:updateTyping', _updateTyping)
  yield Saga.safeTakeEvery('app:changedFocus', _changedFocus)
}

export {registerSagas}
