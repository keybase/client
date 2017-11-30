// @flow
import * as AppGen from '../app-gen'
import * as Types from '../../constants/types/chat'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as Constants from '../../constants/chat'
import * as ChatGen from '../chat-gen'
import * as EngineRpc from '../../constants/engine'
import * as EntityCreators from '../entities'
import * as I from 'immutable'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Selectors from '../../constants/selectors'
import * as Shared from './shared'
import HiddenString from '../../util/hidden-string'
import {chatTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {enableActionLogging} from '../../local-debug'
import {toDeviceType} from '../../constants/devices'
import {type Action} from '../../constants/types/flux'
import {type TypedState} from '../../constants/reducer'

function* _clearConversationMessages({payload: {conversationIDKey}}: ChatGen.ClearMessagesPayload) {
  yield Saga.put(
    EntityCreators.replaceEntity(
      ['conversationMessages'],
      I.Map({[conversationIDKey]: Constants.emptyConversationMessages()})
    )
  )
}

function* _storeMessageToEntity(action: ChatGen.AppendMessagesPayload | ChatGen.PrependMessagesPayload) {
  const newMessages = action.payload.messages
  yield Saga.put(EntityCreators.mergeEntity(['messages'], I.Map(newMessages.map(m => [m.key, m]))))
}

function* _findMessagesToDelete(action: ChatGen.AppendMessagesPayload | ChatGen.PrependMessagesPayload) {
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

function* _findMessageUpdates(action: ChatGen.AppendMessagesPayload | ChatGen.PrependMessagesPayload) {
  const newMessages = action.payload.messages
  type TargetMessageID = string
  const updateIDs: {[key: TargetMessageID]: I.OrderedSet<Types.MessageKey>} = {}
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
    originalAction.type === ChatGen.loadMoreMessages &&
    checkAction.type === ChatGen.clearMessages &&
    originalAction.payload.conversationIDKey === checkAction.payload.conversationIDKey
  )
}

function* _loadMoreMessages(action: ChatGen.LoadMoreMessagesPayload): Saga.SagaGenerator<any, any> {
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

    const rekeyInfoSelector = (state: TypedState, conversationIDKey: Types.ConversationIDKey) => {
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

    yield Saga.put(ChatGen.createLoadingMessages({conversationIDKey, isRequesting: true}))

    const yourName = yield Saga.select(Selectors.usernameSelector)
    const yourDeviceName = yield Saga.select(Shared.devicenameSelector)

    // We receive the list with edit/delete/etc already applied so lets filter that out
    const messageTypes = Object.keys(ChatTypes.commonMessageType)
      .filter(k => !['edit', 'delete', 'headline', 'attachmentuploaded'].includes(k))
      .map(k => ChatTypes.commonMessageType[k])
    const conversationID = Constants.keyToConversationID(conversationIDKey)

    const convMsgs = yield Saga.select(Constants.getConversationMessages, conversationIDKey)
    const messageKeys = convMsgs.messages
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
        conversationID,
        identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
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
      }
    )

    const result = yield Saga.call(loadThreadChanMapRpc.run)

    if (EngineRpc.isFinished(result)) {
      const {payload: {params, error}} = result

      if (error) {
        console.warn('error in localGetThreadNonblock', error)
      }

      if (params.offline) {
        yield Saga.put(ChatGen.createThreadLoadedOffline({conversationIDKey}))
      }

      yield Saga.put(ChatGen.createSetLoaded({conversationIDKey, isLoaded: !error})) // reset isLoaded on error
    } else {
      console.warn('localGetThreadNonblock rpc bailed early')
    }

    // Do this here because it's possible loading messages takes a while
    // If this is the selected conversation and this was a result of user action
    // We can assume the messages we've loaded have been seen.
    const selectedConversationIDKey = yield Saga.select(Constants.getSelectedConversation)
    if (selectedConversationIDKey === conversationIDKey && action.payload.fromUser) {
      yield Saga.put(ChatGen.createUpdateBadging({conversationIDKey}))
      yield Saga.put(ChatGen.createUpdateLatestMessage({conversationIDKey}))
    }
  } finally {
    yield Saga.put(ChatGen.createLoadingMessages({conversationIDKey, isRequesting: false}))
  }
}

function subSagaUpdateThread(yourName, yourDeviceName, conversationIDKey, append) {
  return function* subSagaUpdateThreadHelper({thread}) {
    if (thread) {
      const decThread: ChatTypes.UIMessages = JSON.parse(thread)
      yield Saga.put(
        ChatGen.createUpdateThread({thread: decThread, yourName, yourDeviceName, conversationIDKey, append})
      )
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
    case ChatTypes.localOutboxErrorType.misc:
      return 'unknown error'
    case ChatTypes.localOutboxErrorType.offline:
      return 'disconnected from chat server'
    case ChatTypes.localOutboxErrorType.identify:
      return 'proofs failed for recipient user'
    case ChatTypes.localOutboxErrorType.toolong:
      return 'message is too long'
  }
  return `unknown error type ${typ}`
}

function* _incomingMessage(action: ChatGen.IncomingMessagePayload): Saga.SagaGenerator<any, any> {
  switch (action.payload.activity.activityType) {
    case ChatTypes.notifyChatChatActivityType.failedMessage:
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
              ChatGen.createUpdateTempMessage({
                conversationIDKey,
                message: {
                  ...pendingMessage,
                  failureDescription,
                  messageState: 'failed',
                },
                outboxIDKey: outboxID,
              })
            )
          } else {
            throw new Error("Pending message wasn't found!")
          }
        }
      }
      break
    case ChatTypes.notifyChatChatActivityType.incomingMessage:
      const incomingMessage: ?ChatTypes.IncomingMessage = action.payload.activity.incomingMessage
      if (incomingMessage) {
        // If it's a public chat, the GUI (currently) wants no part of it. We
        // especially don't want to surface the conversation as if it were a
        // private one, which is what we were doing before this change.
        if (
          incomingMessage.conv &&
          incomingMessage.conv.visibility !== RPCTypes.commonTLFVisibility.private
        ) {
          return
        }

        const conversationIDKey = Constants.conversationIDToKey(incomingMessage.convID)
        const messageUnboxed: ChatTypes.UIMessage = incomingMessage.message
        const yourName = yield Saga.select(Selectors.usernameSelector)
        const yourDeviceName = yield Saga.select(Shared.devicenameSelector)
        const message: Types.ServerMessage = _unboxedToMessage(
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
        const selectedConversationIDKey = yield Saga.select(Constants.getSelectedConversation)
        const appFocused = yield Saga.select(Shared.focusedSelector)
        const userActive = yield Saga.select(Shared.activeSelector)
        const selectedTab = yield Saga.select(Shared.routeSelector)
        const chatTabSelected = selectedTab === chatTab
        const conversationIsFocused =
          conversationIDKey === selectedConversationIDKey && appFocused && chatTabSelected && userActive

        if (message.messageID && conversationIsFocused) {
          const {type: msgIDType} = Constants.parseMessageID(message.messageID)
          if (msgIDType === 'rpcMessageID' && message.messageID) {
            yield Saga.call(_markAsRead, conversationIDKey, message.messageID)
          }
        }

        const messageFromYou =
          message.deviceName === yourDeviceName && message.author && yourName === message.author

        if (
          (message.type === 'Text' || message.type === 'Attachment') &&
          messageFromYou &&
          message.outboxID
        ) {
          const outboxID: Types.OutboxIDKey = message.outboxID
          const state = yield Saga.select()
          const pendingMessage = Shared.messageOutboxIDSelector(state, conversationIDKey, outboxID)
          if (pendingMessage) {
            yield Saga.all([
              // If the message has an outboxID and came from our device, then we
              // sent it and have already rendered it in the message list; we just
              // need to mark it as sent.
              Saga.put(ChatGen.createUpdateTempMessage({conversationIDKey, message, outboxIDKey: outboxID})),
              Saga.put(
                ChatGen.createOutboxMessageBecameReal({
                  oldMessageKey: pendingMessage.key,
                  newMessageKey: message.key,
                })
              ),
            ])

            const messageID = message.messageID
            if (messageID) {
              yield Saga.put(
                ChatGen.createMarkSeenMessage({
                  conversationIDKey,
                  messageKey: Constants.messageKey(
                    conversationIDKey,
                    message.type === 'Text' ? 'messageIDText' : 'messageIDAttachment',
                    messageID
                  ),
                })
              )
            }
          }
        } else {
          yield Saga.put(
            ChatGen.createAppendMessages({
              conversationIDKey,
              isSelected: conversationIDKey === selectedConversationIDKey,
              isAppFocused: appFocused,
              messages: [message],
              svcShouldDisplayNotification,
            })
          )
        }
      }
      break
  }
}

// used to key errors. Negative so that we know we made this up and didn't get it from the server
let errorIdx = -1

function _unboxedToMessage(
  message: ChatTypes.UIMessage,
  yourName,
  yourDeviceName,
  conversationIDKey: Types.ConversationIDKey
): Types.ServerMessage {
  if (message && message.state === ChatTypes.chatUiMessageUnboxedState.outbox && message.outbox) {
    // Outbox messages are always text, not attachments.
    const payload: ChatTypes.UIMessageOutbox = message.outbox
    // prettier-ignore
    const messageState: Types.MessageState = payload &&
      payload.state &&
      payload.state.state === ChatTypes.localOutboxStateType.error
      ? 'failed'
      : 'pending'
    // prettier-ignore
    const failureDescription = messageState === 'failed'
      // $FlowIssue
      ? _decodeFailureDescription(payload.state.error.typ)
      : null
    const messageText = message.outbox.body
    const outboxIDKey = payload.outboxID && Constants.stringOutboxIDToKey(payload.outboxID)

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
      message: new HiddenString(messageText),
      messageState,
      outboxID: outboxIDKey,
      rawMessageID: -1,
      senderDeviceRevokedAt: null,
      timestamp: payload.ctime,
      type: 'Text',
      you: yourName,
      ordinal: payload.ordinal,
    }
  }

  if (message.state === ChatTypes.chatUiMessageUnboxedState.valid) {
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
        outboxID: payload.outboxID && Constants.stringOutboxIDToKey(payload.outboxID),
        senderDeviceRevokedAt: payload.senderDeviceRevokedAt,
        timestamp: payload.ctime,
        you: yourName,
        ordinal: payload.messageID,
      }

      switch (payload.messageBody.messageType) {
        case ChatTypes.commonMessageType.text:
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
        case ChatTypes.commonMessageType.attachment: {
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
        case ChatTypes.commonMessageType.attachmentuploaded: {
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
            rawMessageID: common.rawMessageID,
            targetMessageID: Constants.rpcMessageIDToMessageID(attachmentUploaded.messageID),
            timestamp: common.timestamp,
            type: 'UpdateAttachment',
            updates: {
              ...attachmentInfo,
              messageState: 'sent',
            },
          }
        }
        case ChatTypes.commonMessageType.delete:
          const deletedIDs = ((payload.messageBody.delete && payload.messageBody.delete.messageIDs) || [])
            .map(Constants.rpcMessageIDToMessageID)
          return {
            type: 'Deleted',
            timestamp: payload.ctime,
            messageID: common.messageID,
            rawMessageID: common.rawMessageID,
            key: Constants.messageKey(common.conversationIDKey, 'messageIDDeleted', common.messageID),
            deletedIDs,
            ordinal: common.ordinal,
          }
        case ChatTypes.commonMessageType.edit: {
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
            rawMessageID: common.rawMessageID,
            outboxID: common.outboxID,
            mentions: common.mentions,
            channelMention: common.channelMention,
            targetMessageID,
            timestamp: common.timestamp,
            type: 'Edit',
            ordinal: common.ordinal,
          }
        }
        case ChatTypes.commonMessageType.join: {
          const message = new HiddenString('joined')
          return {
            type: 'JoinedLeft',
            messageID: common.messageID,
            rawMessageID: common.rawMessageID,
            author: common.author,
            timestamp: common.timestamp,
            message,
            key: Constants.messageKey(common.conversationIDKey, 'joinedleft', common.messageID),
            ordinal: common.ordinal,
          }
        }
        case ChatTypes.commonMessageType.leave: {
          const message = new HiddenString('left')
          return {
            type: 'JoinedLeft',
            messageID: common.messageID,
            rawMessageID: common.rawMessageID,
            author: common.author,
            timestamp: common.timestamp,
            message,
            key: Constants.messageKey(common.conversationIDKey, 'joinedleft', common.messageID),
            ordinal: common.ordinal,
          }
        }
        case ChatTypes.commonMessageType.system: {
          let sysMsgText = '<unknown system message>'
          const body = payload.messageBody.system
          const meta = body || {systemType: -1}
          if (body) {
            switch (body.systemType) {
              case ChatTypes.localMessageSystemType.addedtoteam: {
                const addee = body.addedtoteam ? `@${body.addedtoteam.addee}` : 'someone'
                const adder = body.addedtoteam ? `@${body.addedtoteam.adder}` : 'someone'
                const team = body.addedtoteam ? `${body.addedtoteam.team}` : '???'
                sysMsgText = `${adder} just added ${addee} to team ${team}.`
                break
              }
              case ChatTypes.localMessageSystemType.inviteaddedtoteam: {
                const invitee = body.inviteaddedtoteam ? `@${body.inviteaddedtoteam.invitee}` : 'someone'
                const adder = body.inviteaddedtoteam ? `@${body.inviteaddedtoteam.adder}` : 'someone'
                const inviter = body.inviteaddedtoteam ? `@${body.inviteaddedtoteam.inviter}` : 'someone'
                const team = body.inviteaddedtoteam ? `${body.inviteaddedtoteam.team}` : '???'
                sysMsgText = `${adder} just added ${invitee} to team ${team}. This user had been invited by ${inviter}`
                break
              }
              case ChatTypes.localMessageSystemType.complexteam: {
                const team = body.complexteam ? body.complexteam.team : '???'
                sysMsgText = `A new channel has been created in team ${team}. Here are some things that are now different:\n\n1.) Notifications will not happen for every message. Click or tap the info icon on the right to configure them.\n2.) The #general channel is now in the "Big Teams" section of the inbox.\n3.) You can hit the three dots next to ${team} in the inbox view to join other channels.\n\nEnjoy!`
                break
              }
            }
          }
          return {
            type: 'System',
            ...common,
            editedCount: payload.superseded ? 1 : 0, // mark it as edited if it's been superseded
            message: new HiddenString(sysMsgText),
            messageState: 'sent',
            meta,
            key: Constants.messageKey(common.conversationIDKey, 'system', common.messageID),
          }
        }
        default:
          const unhandled: Types.UnhandledMessage = {
            ...common,
            key: Constants.messageKey(common.conversationIDKey, 'messageIDUnhandled', common.messageID),
            type: 'Unhandled',
          }
          return unhandled
      }
    }
  }

  if (message.state === ChatTypes.chatUiMessageUnboxedState.error) {
    const error = message.error
    if (error) {
      switch (error.errType) {
        case ChatTypes.localMessageUnboxedErrorType.misc:
        case ChatTypes.localMessageUnboxedErrorType.badversionCritical: // fallthrough
        case ChatTypes.localMessageUnboxedErrorType.identify: // fallthrough
          return {
            conversationIDKey,
            key: Constants.messageKey(
              conversationIDKey,
              'messageIDError',
              Constants.rpcMessageIDToMessageID(error.messageID)
            ),
            messageID: Constants.rpcMessageIDToMessageID(error.messageID),
            rawMessageID: error.messageID,
            reason: error.errMsg || '',
            timestamp: error.ctime,
            type: 'Error',
          }
        case ChatTypes.localMessageUnboxedErrorType.badversion:
          return {
            conversationIDKey,
            key: Constants.messageKey(
              conversationIDKey,
              'errorInvisible',
              Constants.rpcMessageIDToMessageID(error.messageID)
            ),
            data: message,
            messageID: Constants.rpcMessageIDToMessageID(error.messageID),
            rawMessageID: error.messageID,
            timestamp: error.ctime,
            type: 'InvisibleError',
          }
      }
    }
  }

  return {
    type: 'Error',
    rawMessageID: -1,
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
  conversationIDKey: Types.ConversationIDKey,
  messageID: Types.MessageID
): Saga.SagaGenerator<any, any> {
  if (_lastMarkedAsRead[conversationIDKey] === messageID) {
    return
  }

  const conversationID = Constants.keyToConversationID(conversationIDKey)
  const parsed = Constants.parseMessageID(messageID)

  // only mark real messages read
  if (parsed.type === 'rpcMessageID') {
    try {
      yield Saga.call(ChatTypes.localMarkAsReadLocalRpcPromise, {
        conversationID,
        msgID: parsed.msgID,
      })

      _lastMarkedAsRead[conversationIDKey] = messageID
    } catch (err) {
      console.log(`Couldn't mark as read ${conversationIDKey} ${err}`)
    }
  }
}

function _updateBadging({payload: {conversationIDKey}}: ChatGen.UpdateBadgingPayload, state: TypedState) {
  const lastMessageID: ?Types.MessageID = Constants.lastMessageID(state, conversationIDKey)
  // Update gregor's view of the latest message we've read.
  if (conversationIDKey && lastMessageID) {
    return Saga.call(_markAsRead, conversationIDKey, lastMessageID)
  }
}

function _parseChannelMention(channelMention: ChatTypes.ChannelMention): Types.ChannelMention {
  switch (channelMention) {
    case ChatTypes.remoteChannelMention.all:
      return 'All'
    case ChatTypes.remoteChannelMention.here:
      return 'Here'
    default:
      return 'None'
  }
}

function* _updateThread({
  payload: {yourName, thread, yourDeviceName, conversationIDKey, append},
}: ChatGen.UpdateThreadPayload) {
  let newMessages = []
  const newUnboxeds = (thread && thread.messages) || []
  for (const unboxed of newUnboxeds) {
    const message: Types.ServerMessage = _unboxedToMessage(
      unboxed,
      yourName,
      yourDeviceName,
      conversationIDKey
    )

    // If we find a sent message in the list of messages we are adding to the thread, then double check
    // that we do not have any pending messages with the same outbox ID also in the list. If we do, then
    // that pending message was sent and we just missed word about it, so let's just remove it here.
    const messageFromYou =
      message.deviceName === yourDeviceName && message.author && yourName === message.author
    if (
      (message.type === 'Text' || message.type === 'Attachment') &&
      messageFromYou &&
      message.outboxID &&
      message.messageState !== 'pending'
    ) {
      const outboxID: Types.OutboxIDKey = message.outboxID
      const state = yield Saga.select()
      const pendingMessage = Shared.messageOutboxIDSelector(state, conversationIDKey, outboxID)
      if (pendingMessage) {
        // Delete the pre-existing pending version of this message, since we're
        // about to add a newly received version of the same message.
        yield Saga.put(ChatGen.createRemoveOutboxMessage({conversationIDKey, outboxID}))
      }
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
      ChatGen.createAppendMessages({
        conversationIDKey,
        isSelected: conversationIDKey === selectedConversationIDKey,
        isAppFocused: appFocused,
        messages: newMessages,
        svcShouldDisplayNotification: false,
      })
    )
  } else {
    const last = thread && thread.pagination && thread.pagination.last
    yield Saga.put(
      ChatGen.createPrependMessages({conversationIDKey, messages: newMessages, moreToLoad: !last})
    )
  }
}

function _getMessageOrdinal(m: Types.ServerMessage): number {
  switch (m.type) {
    case 'Attachment':
    case 'Text':
      // These pending messages do not have message IDs, instead getting the special ordinal
      // values that will keep them in the correct order in the message list.
      if (m.messageState === 'pending' || m.messageState === 'failed') {
        return m.ordinal
      }
      return m.rawMessageID
    default:
      return m.rawMessageID
  }
}

function addMessagesToConversation(
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey,
  messages: Array<Types.ServerMessage>
): Types.ConversationMessages {
  const currentMessages = Constants.getConversationMessages(state, conversationIDKey)
  // Find all those messages that will grow the current set of messages in either direction. This process
  // both orders the messages correctly, as well as de-dupes.
  const lowMessages = messages.filter((m: Types.ServerMessage) => {
    return _getMessageOrdinal(m) < currentMessages.low
  })
  const highMessages = messages.filter((m: Types.ServerMessage) => {
    return _getMessageOrdinal(m) > currentMessages.high
  })
  const incrMessages = lowMessages.concat(highMessages)

  // Figure out the new bounds for the set of messages. Note the special case for the first setting of low,
  // using the special value of -1, which cannot be set by a normal call
  const newLow = incrMessages.length > 0 &&
    (currentMessages.low < 0 || _getMessageOrdinal(incrMessages[0]) < currentMessages.low)
    ? _getMessageOrdinal(incrMessages[0])
    : currentMessages.low
  const newHigh = incrMessages.length > 0 &&
    _getMessageOrdinal(incrMessages[incrMessages.length - 1]) > currentMessages.high
    ? _getMessageOrdinal(incrMessages[incrMessages.length - 1])
    : currentMessages.high

  // Join the new lists together in the correct order and return the properly formatted result
  const newMessages = lowMessages
    .map(m => m.key)
    .concat(currentMessages.messages.toArray())
    .concat(highMessages.map(m => m.key))
  return Constants.makeConversationMessages({
    high: newHigh,
    low: newLow,
    messages: I.List(newMessages),
  })
}

function* _addMessagesToConversationSaga({
  payload: {conversationIDKey, messages},
}: ChatGen.AppendMessagesPayload) {
  const state: TypedState = yield Saga.select()
  const nextMessages = addMessagesToConversation(state, conversationIDKey, messages)
  yield Saga.put(
    EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))
  )
}

function _updateMessageEntity(action: ChatGen.UpdateTempMessagePayload) {
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
}: ChatGen.OpenConversationPayload): Saga.SagaGenerator<any, any> {
  yield Saga.put(ChatGen.createSelectConversation({conversationIDKey}))
}

function _removeOutboxMessage(
  {payload: {conversationIDKey, outboxID}}: ChatGen.RemoveOutboxMessagePayload,
  s: TypedState
) {
  const convMsgs = Constants.getConversationMessages(s, conversationIDKey)
  const msgKeys: I.List<Types.MessageKey> = convMsgs.messages
  const nextMessages = Constants.makeConversationMessages({
    high: convMsgs.high,
    low: convMsgs.low,
    messages: msgKeys.filter(k => {
      const {messageID} = Constants.splitMessageIDKey(k)
      return messageID !== outboxID
    }),
  })

  if (nextMessages.equals(msgKeys)) {
    return
  }
  console.log('removed outbox message')
  return Saga.put(
    EntityCreators.replaceEntity(['conversationMessages'], I.Map({[conversationIDKey]: nextMessages}))
  )
}

function* _updateOutboxMessageToReal({
  payload: {oldMessageKey, newMessageKey},
}: ChatGen.OutboxMessageBecameRealPayload) {
  const localMessageState = yield Saga.select(Constants.getLocalMessageStateFromMessageKey, oldMessageKey)
  const conversationIDKey = Constants.messageKeyConversationIDKey(newMessageKey)
  const currentMessages = yield Saga.select(Constants.getConversationMessages, conversationIDKey)
  const nextMessages = Constants.makeConversationMessages({
    high: currentMessages.high,
    low: currentMessages.low,
    messages: currentMessages.messages.map(k => (k === oldMessageKey ? newMessageKey : k)),
  })
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

function* _updateMetadata(action: ChatGen.UpdateMetadataPayload): Saga.SagaGenerator<any, any> {
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
      endpoint: 'user/lookup',
      args: [{key: 'usernames', value: usernames.join(',')}, {key: 'fields', value: 'profile'}],
    })

    const parsed = JSON.parse(results.body)
    const payload = {}
    usernames.forEach((username, idx) => {
      const record = parsed.them[idx]
      const fullname = (record && record.profile && record.profile.full_name) || ''
      payload[username] = Constants.makeMetaData({fullname})
    })

    yield Saga.put(ChatGen.createUpdatedMetadata({updated: payload}))
  } catch (err) {
    if (err && err.code === RPCTypes.constantsStatusCode.scapinetworkerror) {
      // Ignore api errors due to offline
    } else {
      throw err
    }
  }
}

function* _changedActive(action: AppGen.ChangedActivePayload): Saga.SagaGenerator<any, any> {
  // Update badging and the latest message due to changing active state.
  const {userActive} = action.payload
  const state: TypedState = yield Saga.select()
  const appFocused = Shared.focusedSelector(state)
  const conversationIDKey = Constants.getSelectedConversation(state)
  const selectedTab = Shared.routeSelector(state)
  const chatTabSelected = selectedTab === chatTab
  // Only do this if focus is retained - otherwise, focus changing logic prevails
  if (conversationIDKey && chatTabSelected && appFocused) {
    if (userActive) {
      yield Saga.put(ChatGen.createUpdateBadging({conversationIDKey}))
    } else {
      // Reset the orange line when becoming inactive
      yield Saga.put(ChatGen.createUpdateLatestMessage({conversationIDKey}))
    }
  }
}

function* _updateTyping({
  payload: {conversationIDKey, typing},
}: ChatGen.UpdateTypingPayload): Saga.SagaGenerator<any, any> {
  // Send we-are-typing info up to Gregor.
  if (!Constants.isPendingConversationIDKey(conversationIDKey)) {
    const conversationID = Constants.keyToConversationID(conversationIDKey)
    yield Saga.call(ChatTypes.localUpdateTypingRpcPromise, {
      conversationID,
      typing,
    })
  }
}

function* _changedFocus(action: AppGen.ChangedFocusPayload): Saga.SagaGenerator<any, any> {
  // Update badging and the latest message due to the refocus.
  const {appFocused} = action.payload
  const state: TypedState = yield Saga.select()
  const conversationIDKey = Constants.getSelectedConversation(state)
  const selectedTab = Shared.routeSelector(state)
  const chatTabSelected = selectedTab === chatTab
  if (conversationIDKey && chatTabSelected) {
    if (appFocused) {
      yield Saga.put(ChatGen.createUpdateBadging({conversationIDKey}))
    } else {
      // Reset the orange line when focus leaves the app.
      yield Saga.put(ChatGen.createUpdateLatestMessage({conversationIDKey}))
    }
  }
}

const safeServerMessageMap = (m: any) => ({
  key: m.key,
  messageID: m.messageID,
  messageState: m.messageState,
  outboxID: m.outboxID,
  type: m.type,
})

function* _logAppendMessages(action: ChatGen.AppendMessagesPayload): Saga.SagaGenerator<any, any> {
  const toPrint = {
    payload: {
      conversationIDKey: action.payload.conversationIDKey,
      messages: action.payload.messages.map(safeServerMessageMap),
      svcShouldDisplayNotification: action.payload.svcShouldDisplayNotification,
    },
    type: action.type,
  }
  console.log('Appending', JSON.stringify(toPrint, null, 2))
}

function* _logPrependMessages(action: ChatGen.PrependMessagesPayload): Saga.SagaGenerator<any, any> {
  const toPrint = {
    payload: {
      conversationIDKey: action.payload.conversationIDKey,
      messages: action.payload.messages.map(safeServerMessageMap),
      moreToLoad: action.payload.moreToLoad,
    },
    type: action.type,
  }
  console.log('Prepending', JSON.stringify(toPrint, null, 2))
}

function* _logUpdateTempMessage(action: ChatGen.UpdateTempMessagePayload): Saga.SagaGenerator<any, any> {
  const toPrint = {
    payload: {conversationIDKey: action.payload.conversationIDKey, outboxIDKey: action.payload.outboxIDKey},
    type: action.type,
  }
  console.log('Update temp message', JSON.stringify(toPrint, null, 2))
}

function* registerSagas(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(AppGen.changedActive, _changedActive)
  yield Saga.safeTakeEvery(ChatGen.clearMessages, _clearConversationMessages)
  yield Saga.safeTakeEvery([ChatGen.appendMessages, ChatGen.prependMessages], _storeMessageToEntity)
  yield Saga.safeTakeEvery([ChatGen.appendMessages, ChatGen.prependMessages], _findMessagesToDelete)
  yield Saga.safeTakeEvery([ChatGen.appendMessages, ChatGen.prependMessages], _findMessageUpdates)
  yield Saga.safeTakeEvery(ChatGen.loadMoreMessages, Saga.cancelWhen(_threadIsCleared, _loadMoreMessages))
  yield Saga.safeTakeEvery(ChatGen.incomingMessage, _incomingMessage)
  yield Saga.safeTakeEvery(ChatGen.updateThread, _updateThread)
  yield Saga.safeTakeEveryPure(ChatGen.updateBadging, _updateBadging)
  yield Saga.safeTakeEveryPure(ChatGen.updateTempMessage, _updateMessageEntity)
  yield Saga.safeTakeEvery([ChatGen.appendMessages, ChatGen.prependMessages], _addMessagesToConversationSaga)
  yield Saga.safeTakeEveryPure(ChatGen.removeOutboxMessage, _removeOutboxMessage)
  yield Saga.safeTakeEvery(ChatGen.outboxMessageBecameReal, _updateOutboxMessageToReal)
  yield Saga.safeTakeEvery(ChatGen.openConversation, _openConversation)
  yield Saga.safeTakeEvery(ChatGen.updateMetadata, _updateMetadata)
  yield Saga.safeTakeEvery(ChatGen.updateTyping, _updateTyping)
  yield Saga.safeTakeEvery(AppGen.changedFocus, _changedFocus)

  if (enableActionLogging) {
    yield Saga.safeTakeEvery(ChatGen.appendMessages, _logAppendMessages)
    yield Saga.safeTakeEvery(ChatGen.prependMessages, _logPrependMessages)
    yield Saga.safeTakeEvery(ChatGen.updateTempMessage, _logUpdateTempMessage)
  }
}

export {registerSagas, addMessagesToConversation}
