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
import {List, Map} from 'immutable'
import {NotifyPopup} from '../../native/notifications'
import {apiserverGetRpcPromise, TlfKeysTLFIdentifyBehavior} from '../../constants/types/flow-types'
import {badgeApp} from '../notifications'
import {call, put, take, select, race, fork, join} from 'redux-saga/effects'
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
import {tmpFile} from '../../util/file'
import {toDeviceType} from '../../constants/types/more'
import {usernameSelector} from '../../constants/selectors'

import type {Action} from '../../constants/types/flux'
import type {ChangedFocus} from '../../constants/app'
import type {TLFIdentifyBehavior} from '../../constants/types/flow-types'
import type {SagaGenerator, ChannelMap} from '../../constants/types/saga'
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

        const conversationState = yield select(Shared.conversationStateSelector, conversationIDKey)
        if (message.type === 'Text' && message.outboxID && message.deviceName === yourDeviceName && yourName === message.author) {
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
            yield put(Creators.markSeenMessage(conversationIDKey, messageID))
          }
        } else {
          // How long was it between the previous message and this one?
          if (conversationState && conversationState.messages !== null && conversationState.messages.size > 0) {
            const timestamp = Shared.maybeAddTimestamp(message, conversationState.messages.toArray(), conversationState.messages.size - 1)
            if (timestamp !== null) {
              yield put(Creators.appendMessages(conversationIDKey, conversationIDKey === selectedConversationIDKey, appFocused, [timestamp]))
            }
          }

          let existingMessage
          if (message.messageID) {
            existingMessage = yield select(Shared.messageSelector, conversationIDKey, message.messageID)
          }

          // If we already have an existing message (say for an attachment, let's reuse that)
          if (existingMessage && existingMessage.outboxID && message.type === 'Attachment') {
            yield put(Creators.updateTempMessage(conversationIDKey, message, existingMessage.outboxID))
          } else {
            yield put(Creators.appendMessages(conversationIDKey, conversationIDKey === selectedConversationIDKey, appFocused, [message]))
          }

          if ((message.type === 'Attachment' || message.type === 'UpdateAttachment') && !message.previewPath && message.messageID) {
            const messageID = message.type === 'UpdateAttachment' ? message.targetMessageID : message.messageID
            const filename = message.type === 'UpdateAttachment' ? message.updates.filename : message.filename
            if (filename) {
              yield put(Creators.loadAttachment(conversationIDKey, messageID, tmpFile(Shared.tmpFileName(false, conversationIDKey, messageID, filename)), true, false))
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

  if (!conversationIDKey) {
    return
  }

  if (Constants.isPendingConversationIDKey(conversationIDKey)) {
    __DEV__ && console.log('Bailing on selected pending conversation no matching inbox')
    return
  }

  const inboxConvo = yield select(Shared.selectedInboxSelector, conversationIDKey)

  if (inboxConvo && inboxConvo.state !== 'unboxed') {
    __DEV__ && console.log('Bailing on not yet unboxed conversation')
    return
  }

  const rekeyInfoSelector = (state: TypedState, conversationIDKey: Constants.ConversationIDKey) => {
    return state.chat.get('rekeyInfos').get(conversationIDKey)
  }
  const rekeyInfo = yield select(rekeyInfoSelector, conversationIDKey)

  if (rekeyInfo) {
    __DEV__ && console.log('Bailing on chat due to rekey info')
    return
  }

  const oldConversationState = yield select(Shared.conversationStateSelector, conversationIDKey)

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

  yield put(Creators.loadingMessages(conversationIDKey, true))

  const yourName = yield select(usernameSelector)
  const yourDeviceName = yield select(Shared.devicenameSelector)

  // We receive the list with edit/delete/etc already applied so lets filter that out
  const messageTypes = Object.keys(ChatTypes.CommonMessageType).filter(k => !['edit', 'delete', 'headline', 'attachmentuploaded'].includes(k)).map(k => ChatTypes.CommonMessageType[k])
  const conversationID = Constants.keyToConversationID(conversationIDKey)

  const updateThread = function * (thread: ChatTypes.ThreadView) {
    const messages = (thread && thread.messages || []).map(message => _unboxedToMessage(message, yourName, yourDeviceName, conversationIDKey)).reverse()
    let newMessages = []
    messages.forEach((message, idx) => {
      if (idx > 0) {
        const timestamp = Shared.maybeAddTimestamp(messages[idx], messages, idx - 1)
        if (timestamp !== null) {
          newMessages.push(timestamp)
        }
      }
      newMessages.push(message)
    })

    const pagination = _threadToPagination(thread)

    yield put(Creators.prependMessages(conversationIDKey, newMessages, !pagination.last, pagination.next))

    // Load previews for attachments
    const attachmentsOnly = messages.reduce((acc: List<Constants.AttachmentMessage>, m) => m && m.type === 'Attachment' && m.messageID ? acc.push(m) : acc, new List())
    yield attachmentsOnly.map(({conversationIDKey, messageID, filename}: Constants.AttachmentMessage) => {
      if (messageID && filename) {
        return put(Creators.loadAttachment(
          conversationIDKey,
          messageID,
          tmpFile(Shared.tmpFileName(false, conversationIDKey, messageID, filename)),
          true,
          false)
        )
      }
    }).toArray().filter(Boolean)
  }

  const channelConfig = Saga.singleFixedChannelConfig([
    'chat.1.chatUi.chatThreadCached',
    'chat.1.chatUi.chatThreadFull',
    'finished',
  ])

  const loadThreadChanMap: ChannelMap<any> = ChatTypes.localGetThreadNonblockRpcChannelMap(channelConfig, {
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
    const incoming: {[key: string]: any} = yield race({
      chatThreadCached: Saga.takeFromChannelMap(loadThreadChanMap, 'chat.1.chatUi.chatThreadCached'),
      chatThreadFull: Saga.takeFromChannelMap(loadThreadChanMap, 'chat.1.chatUi.chatThreadFull'),
      finished: Saga.takeFromChannelMap(loadThreadChanMap, 'finished'),
    })

    if (incoming.chatThreadCached) {
      incoming.chatThreadCached.response.result()
      yield call(updateThread, incoming.chatThreadCached.params.thread)
    } else if (incoming.chatThreadFull) {
      incoming.chatThreadFull.response.result()
      yield call(updateThread, incoming.chatThreadFull.params.thread)
    } else if (incoming.finished) {
      yield put(Creators.loadingMessages(conversationIDKey, false))

      if (incoming.finished.params.offline) {
        yield put(Creators.threadLoadedOffline(conversationIDKey))
      }
      yield put(Creators.setLoaded(conversationIDKey, !incoming.finished.error)) // reset isLoaded on error
      break
    }
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
    // $FlowIssue
    const failureDescription = messageState === 'failed' ? _decodeFailureDescription(payload.state.error.typ) : null
    // $FlowIssue
    const messageText: ChatTypes.MessageText = messageBody.text
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
          return {
            type: 'Text',
            ...common,
            editedCount: payload.serverHeader.supersededBy ? 1 : 0, // mark it as edited if it's been superseded
            message: new HiddenString(payload.messageBody && payload.messageBody.text && payload.messageBody.text.body || ''),
            messageState: 'sent', // TODO, distinguish sent/pending once CORE sends it.
            outboxID,
            key: Constants.messageKey('messageID', common.messageID),
          }
        case ChatTypes.CommonMessageType.attachment: {
          if (!payload.messageBody.attachment) {
            throw new Error('empty attachment body')
          }
          const attachment: ChatTypes.MessageAttachment = payload.messageBody.attachment
          const preview = attachment && attachment.preview
          const mimeType = preview && preview.mimeType
          const previewMetadata = preview && preview.metadata
          const previewSize = previewMetadata && Constants.parseMetadataPreviewSize(previewMetadata)

          const previewIsVideo = previewMetadata && previewMetadata.assetType === ChatTypes.LocalAssetMetadataType.video
          let previewDurationMs = null
          if (previewIsVideo) {
            const previewVideoMetadata = previewMetadata && previewMetadata.assetType === ChatTypes.LocalAssetMetadataType.video && previewMetadata.video
            previewDurationMs = previewVideoMetadata ? previewVideoMetadata.durationMs : null
          }

          const objectMetadata = attachment && attachment.object && attachment.object.metadata
          const objectIsVideo = objectMetadata && objectMetadata.assetType === ChatTypes.LocalAssetMetadataType.video
          let attachmentDurationMs = null
          if (objectIsVideo) {
            const objectVideoMetadata = objectMetadata && objectMetadata.assetType === ChatTypes.LocalAssetMetadataType.video && objectMetadata.video
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
        case ChatTypes.CommonMessageType.attachmentuploaded: {
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
        case ChatTypes.CommonMessageType.delete:
          const deletedIDs = payload.messageBody.delete && payload.messageBody.delete.messageIDs || []
          return {
            type: 'Deleted',
            timestamp: payload.serverHeader.ctime,
            messageID: payload.serverHeader.messageID,
            key: Constants.messageKey('messageID', common.messageID),
            deletedIDs,
          }
        case ChatTypes.CommonMessageType.edit: {
          const message = new HiddenString(payload.messageBody && payload.messageBody.edit && payload.messageBody.edit.body || '')
          const outboxID = payload.clientHeader.outboxID && Constants.outboxIDToKey(payload.clientHeader.outboxID)
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
          const unhandled: Constants.UnhandledMessage = {
            ...common,
            key: Constants.messageKey('messageID', common.messageID),
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
            key: Constants.messageKey('error', errorIdx++),
            messageID: error.messageID,
            reason: error.errMsg || '',
            timestamp: error.ctime,
            type: 'Error',
          }
        case ChatTypes.LocalMessageUnboxedErrorType.badversion:
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

  const inboxSelector = (state: TypedState, tlfName: string) => {
    return state.chat.get('inbox').find(convo => convo.get('participants').sort().join(',') === tlfName)
  }
  const tlfName = users.sort().join(',')
  const existing = yield select(inboxSelector, tlfName)

  if (forceImmediate && existing) {
    yield call(Shared.startNewConversation, existing.get('conversationIDKey'))
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
}

function * _selectConversation (action: Constants.SelectConversation): SagaGenerator<any, any> {
  const {conversationIDKey, fromUser} = action.payload
  const oldConversationState = yield select(Shared.conversationStateSelector, conversationIDKey)
  if (oldConversationState && oldConversationState.get('isStale') && conversationIDKey) {
    yield put(Creators.clearMessages(conversationIDKey))
  }

  let loadMoreTask
  if (conversationIDKey) {
    loadMoreTask = yield fork(Saga.cancelWhen(_threadIsCleared, _loadMoreMessages), Creators.loadMoreMessages(conversationIDKey, true))
    yield put(navigateTo([conversationIDKey], [chatTab]))
  } else {
    yield put(navigateTo([], [chatTab]))
  }

  const inbox = yield select(Shared.selectedInboxSelector, conversationIDKey)
  if (inbox) {
    yield put(Creators.updateMetadata(inbox.get('participants').toArray()))
  }

  if (inbox && inbox.get('state') !== 'unboxed') {
    return
  }

  if (fromUser && conversationIDKey) {
    yield join(loadMoreTask)
    yield put(Creators.updateBadging(conversationIDKey))
    yield put(Creators.updateLatestMessage(conversationIDKey))
  }
}

function * _blockConversation (action: Constants.BlockConversation): SagaGenerator<any, any> {
  const {blocked, conversationIDKey} = action.payload
  const conversationID = Constants.keyToConversationID(conversationIDKey)
  const status = blocked ? ChatTypes.CommonConversationStatus.blocked : ChatTypes.CommonConversationStatus.unfiled
  const identifyBehavior: TLFIdentifyBehavior = TlfKeysTLFIdentifyBehavior.chatGui
  yield call(ChatTypes.localSetConversationStatusLocalRpcPromise, {
    param: {conversationID, identifyBehavior, status},
  })
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

  if (conversationIDKey && appFocused && chatTabSelected) {
    yield put(Creators.updateBadging(conversationIDKey))
    yield put(Creators.updateLatestMessage(conversationIDKey))
  }
}

function * _badgeAppForChat (action: Constants.BadgeAppForChat): SagaGenerator<any, any> {
  const conversations = action.payload
  const selectedConversationIDKey = yield select(Constants.getSelectedConversation)
  const appFocused = yield select(Shared.focusedSelector)

  const newConversations = conversations.reduce((acc, conv) => {
    // Badge this conversation if it's unread and either the app doesn't have
    // focus (so the user didn't see the message) or the conversation isn't
    // selected (same).
    const unread = conv.get('UnreadMessages') > 0
    const selected = (Constants.conversationIDToKey(conv.get('convID')) === selectedConversationIDKey)
    const addThisConv = (unread && (!selected || !appFocused))
    // Desktop shows number of thread unread. Mobile shows number of messages unread
    const toAdd = isMobile ? conv.get('UnreadMessages') : 1
    return addThisConv ? acc + toAdd : acc
  }, 0)
  yield put(badgeApp('chatInbox', newConversations > 0, newConversations))

  let conversationsWithKeys = {}
  conversations.map(conv => {
    conversationsWithKeys[Constants.conversationIDToKey(conv.get('convID'))] = conv.get('UnreadMessages')
  })
  const conversationUnreadCounts = Map(conversationsWithKeys)
  yield put(Creators.updateConversationUnreadCounts(conversationUnreadCounts))
}

function * _sendNotifications (action: Constants.AppendMessages): SagaGenerator<any, any> {
  const appFocused = yield select(Shared.focusedSelector)
  const selectedTab = yield select(Shared.routeSelector)
  const chatTabSelected = (selectedTab === chatTab)
  const convoIsSelected = action.payload.isSelected

  // Only send if you're not looking at it
  if (!convoIsSelected || !appFocused || !chatTabSelected) {
    const me = yield select(usernameSelector)
    const message = (action.payload.messages.reverse().find(m => m.type === 'Text' && m.author !== me))
    // Is this message part of a muted conversation? If so don't notify.
    const convo = yield select(Shared.selectedInboxSelector, action.payload.conversationIDKey)
    if (convo && !convo.muted) {
      if (message && message.type === 'Text') {
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
  yield [
    Saga.safeTakeSerially('chat:loadInbox', Inbox.onInitialInboxLoad),
    Saga.safeTakeLatest('chat:inboxStale', Inbox.onInboxStale),
    Saga.safeTakeEvery('chat:loadMoreMessages', Saga.cancelWhen(_threadIsCleared, _loadMoreMessages)),
    Saga.safeTakeLatest('chat:selectConversation', _selectConversation),
    Saga.safeTakeEvery('chat:untrustedInboxVisible', Inbox.untrustedInboxVisible),
    Saga.safeTakeEvery('chat:updateBadging', _updateBadging),
    Saga.safeTakeEvery('chat:setupChatHandlers', _setupChatHandlers),
    Saga.safeTakeEvery('chat:incomingMessage', _incomingMessage),
    Saga.safeTakeEvery('chat:markThreadsStale', _markThreadsStale),
    Saga.safeTakeEvery('chat:muteConversation', _muteConversation),
    Saga.safeTakeEvery('chat:blockConversation', _blockConversation),
    Saga.safeTakeEvery('chat:newChat', _newChat),
    Saga.safeTakeEvery('chat:postMessage', Messages.postMessage),
    Saga.safeTakeEvery('chat:editMessage', Messages.editMessage),
    Saga.safeTakeEvery('chat:retryMessage', Messages.retryMessage),
    Saga.safeTakeEvery('chat:startConversation', _startConversation),
    Saga.safeTakeEvery('chat:updateMetadata', _updateMetadata),
    Saga.safeTakeEvery('chat:appendMessages', _sendNotifications),
    Saga.safeTakeEvery('chat:selectAttachment', Attachment.onSelectAttachment),
    Saga.safeTakeEvery('chat:openConversation', _openConversation),
    Saga.safeTakeEvery('chat:getInboxAndUnbox', Inbox.onGetInboxAndUnbox),
    Saga.safeTakeEvery('chat:loadAttachment', Attachment.onLoadAttachment),
    Saga.safeTakeEvery('chat:openAttachmentPopup', Attachment.onOpenAttachmentPopup),
    Saga.safeTakeLatest('chat:openFolder', _openFolder),
    Saga.safeTakeLatest('chat:badgeAppForChat', _badgeAppForChat),
    Saga.safeTakeEvery('app:changedFocus', _changedFocus),
    Saga.safeTakeEvery('chat:deleteMessage', Messages.deleteMessage),
    Saga.safeTakeEvery('chat:openTlfInChat', _openTlfInChat),
    Saga.safeTakeEvery('chat:loadedInbox', _ensureValidSelectedChat, true, false),
    Saga.safeTakeEvery('chat:updateInboxComplete', _ensureValidSelectedChat, false, false),
    Saga.safeTakeEvery('chat:saveAttachmentNative', Attachment.onSaveAttachmentNative),
    Saga.safeTakeEvery('chat:shareAttachment', Attachment.onShareAttachment),
  ]
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
