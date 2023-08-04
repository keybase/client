import * as Z from '../util/zustand'
import * as Chat2Gen from './chat2-gen'
import * as ConfigConstants from '../constants/config'
import * as RouterConstants from '../constants/router2'
import * as UsersConstants from '../constants/users'
import * as LinksConstants from '../constants/deeplinks'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as FsConstants from '../constants/fs'
import * as FsTypes from '../constants/types/fs'
import * as Platform from '../constants/platform'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from './../constants/types/rpc-gen'
import * as Styles from '../styles'
import * as Tabs from '../constants/tabs'
import * as TeamsConstants from '../constants/teams'
import * as TeamsTypes from '../constants/types/teams'
import * as Types from '../constants/types/chat2'
import * as WaitingConstants from '../constants/waiting'
import {findLast} from '../util/arrays'
import KB2 from '../util/electron'
import NotifyPopup from '../util/notify-popup'
import logger from '../logger'
import {RPCError} from '../util/errors'
import {isIOS} from '../constants/platform'
import {saveAttachmentToCameraRoll, showShareActionSheet} from './platform-specific'

const {darwinCopyToChatTempUploadFile} = KB2.functions

const getClientPrev = (conversationIDKey: Types.ConversationIDKey): Types.MessageID => {
  let clientPrev: undefined | Types.MessageID
  const mm = Constants.getConvoState(conversationIDKey).messageMap
  if (mm) {
    // find last valid messageid we know about
    const goodOrdinal = findLast(Constants.getConvoState(conversationIDKey).messageOrdinals ?? [], o => {
      const m = mm.get(o)
      return !!m?.id
    })

    if (goodOrdinal) {
      const message = mm.get(goodOrdinal)
      clientPrev = message && message.id
    }
  }

  return clientPrev || 0
}

const onGetInboxUnverifiedConvs = (_: unknown, action: EngineGen.Chat1ChatUiChatInboxUnverifiedPayload) => {
  const {inbox} = action.payload.params
  const result = JSON.parse(inbox) as RPCChatTypes.UnverifiedInboxUIItems
  const items: Array<RPCChatTypes.UnverifiedInboxUIItem> = result.items ?? []
  // We get a subset of meta information from the cache even in the untrusted payload
  const metas = items.reduce<Array<Types.ConversationMeta>>((arr, item) => {
    const m = Constants.unverifiedInboxUIItemToConversationMeta(item)
    m && arr.push(m)
    return arr
  }, [])
  Constants.useState.getState().dispatch.setTrustedInboxHasLoaded()
  // Check if some of our existing stored metas might no longer be valid
  Constants.useState.getState().dispatch.metasReceived(metas)
}

const onGetInboxConvsUnboxed = (_: unknown, action: EngineGen.Chat1ChatUiChatInboxConversationPayload) => {
  // TODO not reactive
  const {infoMap} = UsersConstants.useState.getState()
  const actions: Array<Container.TypedActions> = []
  const {convs} = action.payload.params
  const inboxUIItems = JSON.parse(convs) as Array<RPCChatTypes.InboxUIItem>
  const metas: Array<Types.ConversationMeta> = []
  let added = false
  const usernameToFullname: {[username: string]: string} = {}
  inboxUIItems.forEach(inboxUIItem => {
    const meta = Constants.inboxUIItemToConversationMeta(inboxUIItem)
    if (meta) {
      metas.push(meta)
    }
    const participantInfo: Types.ParticipantInfo = Constants.uiParticipantsToParticipantInfo(
      inboxUIItem.participants ?? []
    )
    if (participantInfo.all.length > 0) {
      Constants.getConvoState(Types.stringToConversationIDKey(inboxUIItem.convID)).dispatch.setParticipants(
        participantInfo
      )
    }
    inboxUIItem.participants?.forEach((part: RPCChatTypes.UIParticipant) => {
      const {assertion, fullName} = part
      if (!infoMap.get(assertion) && fullName) {
        added = true
        usernameToFullname[assertion] = fullName
      }
    })
  })
  if (added) {
    UsersConstants.useState
      .getState()
      .dispatch.updates(
        Object.keys(usernameToFullname).map(name => ({info: {fullname: usernameToFullname[name]}, name}))
      )
  }
  if (metas.length > 0) {
    Constants.useState.getState().dispatch.metasReceived(metas)
  }
  return actions
}

const maybeChangeSelectedConv = () => {
  const selectedConversation = Constants.getSelectedConversation()
  const {inboxLayout} = Constants.useState.getState()
  if (!inboxLayout || !inboxLayout.reselectInfo) {
    return false
  }
  const {reselectInfo} = inboxLayout
  if (
    !Constants.isValidConversationIDKey(selectedConversation) ||
    selectedConversation === reselectInfo.oldConvID
  ) {
    if (Container.isPhone) {
      // on mobile just head back to the inbox if we have something selected
      if (Constants.isValidConversationIDKey(selectedConversation)) {
        logger.info(`maybeChangeSelectedConv: mobile: navigating up on conv change`)
        return Chat2Gen.createNavigateToInbox()
      }
      logger.info(`maybeChangeSelectedConv: mobile: ignoring conv change, no conv selected`)
      return false
    }
    if (reselectInfo.newConvID) {
      logger.info(`maybeChangeSelectedConv: selecting new conv: ${reselectInfo.newConvID}`)
      return Chat2Gen.createNavigateToThread({
        conversationIDKey: reselectInfo.newConvID,
        reason: 'findNewestConversation',
      })
    } else {
      logger.info(`maybeChangeSelectedConv: deselecting conv, service provided no new conv`)
      return Chat2Gen.createNavigateToThread({
        conversationIDKey: Constants.noConversationIDKey,
        reason: 'findNewestConversation',
      })
    }
  } else {
    logger.info(
      `maybeChangeSelectedConv: selected conv mismatch on reselect (ignoring): selected: ${selectedConversation} srvold: ${reselectInfo.oldConvID}`
    )
    return false
  }
}

// Some participants are broken/fixed now
const onChatIdentifyUpdate = (_: unknown, action: EngineGen.Chat1NotifyChatChatIdentifyUpdatePayload) => {
  const {update} = action.payload.params
  const usernames = update.CanonicalName.split(',')
  const broken = (update.breaks.breaks || []).map(b => b.user.username)
  const updates = usernames.map(name => ({info: {broken: broken.includes(name)}, name}))
  UsersConstants.useState.getState().dispatch.updates(updates)
}

const onChatPromptUnfurl = (_: unknown, action: EngineGen.Chat1NotifyChatChatPromptUnfurlPayload) => {
  const {convID, domain, msgID} = action.payload.params
  Constants.getConvoState(Types.conversationIDToKey(convID)).dispatch.unfurlTogglePrompt(
    Types.numberToMessageID(msgID),
    domain,
    true
  )
}

const onChatInboxSyncStarted = () => {
  const {increment} = WaitingConstants.useWaitingState.getState().dispatch
  increment(Constants.waitingKeyInboxSyncStarted)
}

// Service tells us it's done syncing
const onChatInboxSynced = (
  _state: Container.TypedState,
  action: EngineGen.Chat1NotifyChatChatInboxSyncedPayload
) => {
  const {syncRes} = action.payload.params

  const {clear} = WaitingConstants.useWaitingState.getState().dispatch
  const {inboxRefresh} = Constants.useState.getState().dispatch
  clear(Constants.waitingKeyInboxSyncStarted)
  const actions: Array<Container.TypedActions> = []

  switch (syncRes.syncType) {
    // Just clear it all
    case RPCChatTypes.SyncInboxResType.clear:
      inboxRefresh('inboxSyncedClear')
      break
    // We're up to date
    case RPCChatTypes.SyncInboxResType.current:
      break
    // We got some new messages appended
    case RPCChatTypes.SyncInboxResType.incremental: {
      const selectedConversation = Constants.getSelectedConversation()
      const items = syncRes.incremental?.items || []
      const metas = items.reduce<Array<Types.ConversationMeta>>((arr, i) => {
        const meta = Constants.unverifiedInboxUIItemToConversationMeta(i.conv)
        if (meta) {
          if (meta.conversationIDKey === selectedConversation) {
            // First thing load the messages
            actions.unshift(
              Chat2Gen.createMarkConversationsStale({
                conversationIDKeys: [selectedConversation],
                updateType: RPCChatTypes.StaleUpdateType.newactivity,
              })
            )
          }
          arr.push(meta)
        }
        return arr
      }, [])
      const removals = ((!syncRes.incremental ? undefined : syncRes.incremental.removals) || []).map(
        Types.stringToConversationIDKey
      )
      // Update new untrusted
      if (metas.length || removals.length) {
        Constants.useState.getState().dispatch.metasReceived(metas, removals)
      }

      Constants.useState.getState().dispatch.unboxRows(
        items.filter(i => i.shouldUnbox).map(i => Types.stringToConversationIDKey(i.conv.convID)),
        true
      )
      break
    }
    default:
      inboxRefresh('inboxSyncedUnknown')
  }
  return actions
}

const onChatPaymentInfo = (_: unknown, action: EngineGen.Chat1NotifyChatChatPaymentInfoPayload) => {
  const {convID, info, msgID} = action.payload.params
  const conversationIDKey = convID ? Types.conversationIDToKey(convID) : Constants.noConversationIDKey
  const paymentInfo = Constants.uiPaymentInfoToChatPaymentInfo([info])
  if (!paymentInfo) {
    // This should never happen
    const errMsg = `got 'NotifyChat.ChatPaymentInfo' with no valid paymentInfo for convID ${conversationIDKey} messageID: ${msgID}. The local version may be absent or out of date.`
    logger.error(errMsg)
    throw new Error(errMsg)
  }
  Constants.useState.getState().dispatch.paymentInfoReceived(paymentInfo)
  Constants.getConvoState(conversationIDKey).dispatch.paymentInfoReceived(msgID, paymentInfo)
}

const onChatRequestInfo = (_: unknown, action: EngineGen.Chat1NotifyChatChatRequestInfoPayload) => {
  const {convID, info, msgID} = action.payload.params
  const conversationIDKey = Types.conversationIDToKey(convID)
  const requestInfo = Constants.uiRequestInfoToChatRequestInfo(info)
  if (!requestInfo) {
    // This should never happen
    const errMsg = `got 'NotifyChat.ChatRequestInfo' with no valid requestInfo for convID ${conversationIDKey} messageID: ${msgID}. The local version may be absent or out of date.`
    logger.error(errMsg)
    throw new Error(errMsg)
  }
  Constants.getConvoState(conversationIDKey).dispatch.requestInfoReceived(msgID, requestInfo)
}

const onChatSubteamRename = (_: unknown, action: EngineGen.Chat1NotifyChatChatSubteamRenamePayload) => {
  const {convs} = action.payload.params
  const conversationIDKeys = (convs ?? []).map(c => Types.stringToConversationIDKey(c.convID))
  Constants.useState.getState().dispatch.unboxRows(conversationIDKeys, true)
}

const onChatChatTLFFinalizePayload = (
  _: unknown,
  action: EngineGen.Chat1NotifyChatChatTLFFinalizePayload
) => {
  const {convID} = action.payload.params
  Constants.useState.getState().dispatch.unboxRows([Types.conversationIDToKey(convID)])
}

const onChatThreadStale = (_: unknown, action: EngineGen.Chat1NotifyChatChatThreadsStalePayload) => {
  const {updates} = action.payload.params
  let actions: Array<Container.TypedActions> = []
  const keys = ['clear', 'newactivity'] as const
  if (__DEV__) {
    if (keys.length * 2 !== Object.keys(RPCChatTypes.StaleUpdateType).length) {
      throw new Error('onChatThreadStale invalid enum')
    }
  }
  keys.forEach(key => {
    const conversationIDKeys = (updates || []).reduce<Array<string>>((arr, u) => {
      if (u.updateType === RPCChatTypes.StaleUpdateType[key]) {
        arr.push(Types.conversationIDToKey(u.convID))
      }
      return arr
    }, [])
    // load the inbox instead
    if (conversationIDKeys.length > 0) {
      logger.info(
        `onChatThreadStale: dispatching thread reload actions for ${conversationIDKeys.length} convs of type ${key}`
      )

      Constants.useState.getState().dispatch.unboxRows(conversationIDKeys, true)
      actions = actions.concat([
        Chat2Gen.createMarkConversationsStale({
          conversationIDKeys,
          updateType: RPCChatTypes.StaleUpdateType[key],
        }),
      ])
    }
  })
  return actions
}

const onChatConvUpdate = (_: unknown, action: EngineGen.Chat1NotifyChatChatConvUpdatePayload) => {
  const {conv} = action.payload.params
  if (conv) {
    const meta = Constants.inboxUIItemToConversationMeta(conv)
    if (meta) {
      Constants.useState.getState().dispatch.metasReceived([meta])
    }
  }
}

// Show a desktop notification
const desktopNotify = async (_: unknown, action: Chat2Gen.DesktopNotificationPayload) => {
  const {conversationIDKey, author, body} = action.payload
  const meta = Constants.getConvoState(conversationIDKey).meta

  if (
    Constants.isUserActivelyLookingAtThisThread(conversationIDKey) ||
    meta.isMuted // ignore muted convos
  ) {
    logger.info('not sending notification')
    return
  }

  logger.info('sending chat notification')
  let title = ['small', 'big'].includes(meta.teamType) ? meta.teamname : author
  if (meta.teamType === 'big') {
    title += `#${meta.channelname}`
  }

  const actions = await new Promise<Array<Container.TypedActions>>(resolve => {
    const onClick = () => {
      ConfigConstants.useConfigState.getState().dispatch.showMain()
      resolve([
        Chat2Gen.createNavigateToInbox(),
        Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'desktopNotification'}),
      ])
    }
    const onClose = () => {
      resolve([])
    }
    logger.info('invoking NotifyPopup for chat notification')
    const sound = ConfigConstants.useConfigState.getState().notifySound
    NotifyPopup(title, {body, sound}, -1, author, onClick, onClose)
  })

  return actions
}

// Delete a message. We cancel pending messages
const messageDelete = async (_: unknown, action: Chat2Gen.MessageDeletePayload) => {
  const {conversationIDKey, ordinal} = action.payload
  const message = Constants.getConvoState(conversationIDKey).messageMap.get(ordinal)
  if (!message) {
    logger.warn('Deleting message')
    logger.debug('Deleting invalid message:', message)
    return false
  }

  const meta = Constants.getConvoState(conversationIDKey).meta
  if (meta.conversationIDKey !== conversationIDKey) {
    logger.warn('Deleting message w/ no meta')
    logger.debug('Deleting message w/ no meta', message)
    return false
  }

  // We have to cancel pending messages
  if (!message.id) {
    if (message.outboxID) {
      await RPCChatTypes.localCancelPostRpcPromise(
        {outboxID: Types.outboxIDToRpcOutboxID(message.outboxID)},
        Constants.waitingKeyCancelPost
      )
      return Chat2Gen.createMessagesWereDeleted({conversationIDKey, ordinals: [message.ordinal]})
    } else {
      logger.warn('Delete of no message id and no outboxid')
    }
  } else {
    await RPCChatTypes.localPostDeleteNonblockRpcPromise(
      {
        clientPrev: 0,
        conversationID: Types.keyToConversationID(conversationIDKey),
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        outboxID: null,
        supersedes: message.id,
        tlfName: meta.tlfname,
        tlfPublic: false,
      },
      Constants.waitingKeyDeletePost
    )
  }
  return false
}

const messageEdit = async (
  _: unknown,
  action: Chat2Gen.MessageEditPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey, text, ordinal} = action.payload
  const message = Constants.getConvoState(conversationIDKey).messageMap.get(ordinal)
  if (!message) {
    logger.warn("Can't find message to edit", ordinal)
    return
  }

  if (message.type === 'text' || message.type === 'attachment') {
    // Skip if the content is the same
    if (message.type === 'text' && message.text.stringValue() === text.stringValue()) {
      Constants.getConvoState(conversationIDKey).dispatch.setEditing(false)
      return
    } else if (message.type === 'attachment' && message.title === text.stringValue()) {
      Constants.getConvoState(conversationIDKey).dispatch.setEditing(false)
      return
    }
    const meta = Constants.getConvoState(conversationIDKey).meta
    const tlfName = meta.tlfname
    const clientPrev = getClientPrev(conversationIDKey)
    const outboxID = Constants.generateOutboxID()
    const target = {
      messageID: message.id,
      outboxID: message.outboxID ? Types.outboxIDToRpcOutboxID(message.outboxID) : undefined,
    }
    await RPCChatTypes.localPostEditNonblockRpcPromise(
      {
        body: text.stringValue(),
        clientPrev,
        conversationID: Types.keyToConversationID(conversationIDKey),
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        outboxID,
        target,
        tlfName,
        tlfPublic: false,
      },
      Constants.waitingKeyEditPost
    )

    if (!message.id) {
      listenerApi.dispatch(Chat2Gen.createPendingMessageWasEdited({conversationIDKey, ordinal, text}))
    }
  }
}

const onReplyJump = (_: unknown, action: Chat2Gen.ReplyJumpPayload) =>
  Chat2Gen.createLoadMessagesCentered({
    conversationIDKey: action.payload.conversationIDKey,
    highlightMode: 'flash',
    messageID: action.payload.messageID,
  })

const messageSend = async (
  _: unknown,
  action: Chat2Gen.MessageSendPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey, text, replyTo} = action.payload

  const meta = Constants.getConvoState(conversationIDKey).meta
  const tlfName = meta.tlfname
  const clientPrev = getClientPrev(conversationIDKey)

  // disable sending exploding messages if flag is false
  const ephemeralLifetime = Constants.getConvoState(conversationIDKey).explodingMode
  const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
  const confirmRouteName = 'chatPaymentsConfirm'
  try {
    await RPCChatTypes.localPostTextNonblockRpcListener(
      {
        customResponseIncomingCallMap: {
          'chat.1.chatUi.chatStellarDataConfirm': (_, response) => {
            // immediate fail
            response.result(false)
          },
          'chat.1.chatUi.chatStellarDataError': (_, response) => {
            // immediate fail
            response.result(false)
          },
        },
        incomingCallMap: {
          'chat.1.chatUi.chatStellarDone': ({canceled}) => {
            const visibleScreen = RouterConstants.getVisibleScreen()
            if (visibleScreen && visibleScreen.name === confirmRouteName) {
              RouterConstants.useState.getState().dispatch.clearModals()
              return
            }
            if (canceled) {
              Constants.getConvoState(conversationIDKey).dispatch.setUnsentText(text.stringValue())
              return
            }
            return false
          },
          'chat.1.chatUi.chatStellarShowConfirm': () => {},
        },
        params: {
          ...ephemeralData,
          body: text.stringValue(),
          clientPrev,
          conversationID: Types.keyToConversationID(conversationIDKey),
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          outboxID: undefined,
          replyTo,
          tlfName,
          tlfPublic: false,
        },
        waitingKey: action.payload.waitingKey || Constants.waitingKeyPost,
      },
      listenerApi
    )
    logger.info('success')
  } catch (_) {
    logger.info('error')
  }

  // If there are block buttons on this conversation, clear them.
  if (Constants.useState.getState().blockButtonsMap.has(meta.teamID)) {
    listenerApi.dispatch(Chat2Gen.createDismissBlockButtons({teamID: meta.teamID}))
  }

  // Do some logging to track down the root cause of a bug causing
  // messages to not send. Do this after creating the objects above to
  // narrow down the places where the action can possibly stop.
  logger.info('non-empty text?', text.stringValue().length > 0)
}

const messageSendByUsernames = async (_: unknown, action: Chat2Gen.MessageSendByUsernamesPayload) => {
  const username = ConfigConstants.useCurrentUserState.getState().username
  const tlfName = `${username},${action.payload.usernames}`
  try {
    const result = await RPCChatTypes.localNewConversationLocalRpcPromise(
      {
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        membersType: RPCChatTypes.ConversationMembersType.impteamnative,
        tlfName,
        tlfVisibility: RPCTypes.TLFVisibility.private,
        topicType: RPCChatTypes.TopicType.chat,
      },
      action.payload.waitingKey
    )
    const {text, waitingKey} = action.payload
    return Chat2Gen.createMessageSend({
      conversationIDKey: Types.conversationIDToKey(result.conv.info.id),
      text,
      waitingKey,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.warn('Could not send in messageSendByUsernames', error.message)
    }
  }
  return []
}

type StellarConfirmWindowResponse = {result: (b: boolean) => void}
let _stellarConfirmWindowResponse: StellarConfirmWindowResponse | undefined

function storeStellarConfirmWindowResponse(accept: boolean, response?: StellarConfirmWindowResponse) {
  _stellarConfirmWindowResponse?.result(accept)
  _stellarConfirmWindowResponse = response
}

const confirmScreenResponse = (_: unknown, action: Chat2Gen.ConfirmScreenResponsePayload) => {
  storeStellarConfirmWindowResponse(action.payload.accept)
}

// We always make adhoc convos and never preview it
const previewConversationPersonMakesAConversation = (
  _: unknown,
  action: Chat2Gen.PreviewConversationPayload
) => {
  const {participants, teamname, reason, highlightMessageID} = action.payload
  if (teamname) return false
  if (!participants) return false

  // if stellar just search first, could do others maybe
  if ((reason === 'requestedPayment' || reason === 'sentPayment') && participants.length === 1) {
    const username = ConfigConstants.useCurrentUserState.getState().username
    const toFind = participants[0]
    for (const cs of Constants.stores.values()) {
      const p = cs.getState().participants
      if (p.name.length === 2) {
        const other = p.name.filter(n => n !== username)
        if (other[0] === toFind) {
          return Chat2Gen.createNavigateToThread({
            conversationIDKey: cs.getState().id,
            reason: 'justCreated',
          })
        }
      }
    }
  }

  return [
    Chat2Gen.createNavigateToThread({
      conversationIDKey: Constants.pendingWaitingConversationIDKey,
      reason: 'justCreated',
    }),
    Chat2Gen.createCreateConversation({highlightMessageID, participants}),
  ]
}

// We preview channels
const previewConversationTeam = async (_: unknown, action: Chat2Gen.PreviewConversationPayload) => {
  const {conversationIDKey, highlightMessageID, teamname, reason} = action.payload
  if (conversationIDKey) {
    if (
      reason === 'messageLink' ||
      reason === 'teamMention' ||
      reason === 'channelHeader' ||
      reason === 'manageView'
    ) {
      // Add preview channel to inbox
      await RPCChatTypes.localPreviewConversationByIDLocalRpcPromise({
        convID: Types.keyToConversationID(conversationIDKey),
      })
    }
    return Chat2Gen.createNavigateToThread({conversationIDKey, highlightMessageID, reason: 'previewResolved'})
  }

  if (!teamname) {
    return false
  }

  const channelname = action.payload.channelname || 'general'

  try {
    const results = await RPCChatTypes.localFindConversationsLocalRpcPromise({
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      membersType: RPCChatTypes.ConversationMembersType.team,
      oneChatPerTLF: true,
      tlfName: teamname,
      topicName: channelname,
      topicType: RPCChatTypes.TopicType.chat,
      visibility: RPCTypes.TLFVisibility.private,
    })
    const resultMetas = (results.uiConversations || [])
      .map(row => Constants.inboxUIItemToConversationMeta(row))
      .filter(Boolean)

    const first = resultMetas[0]
    if (!first) {
      if (action.payload.reason === 'appLink') {
        LinksConstants.useState
          .getState()
          .dispatch.setLinkError(
            "We couldn't find this team chat channel. Please check that you're a member of the team and the channel exists."
          )
        RouterConstants.useState.getState().dispatch.navigateAppend('keybaseLinkError')
        return
      } else {
        return []
      }
    }

    const results2 = await RPCChatTypes.localPreviewConversationByIDLocalRpcPromise({
      convID: Types.keyToConversationID(first.conversationIDKey),
    })
    const actions: Array<Container.TypedActions> = []
    const meta = Constants.inboxUIItemToConversationMeta(results2.conv)
    if (meta) {
      Constants.useState.getState().dispatch.metasReceived([meta])
    }
    actions.push(
      Chat2Gen.createNavigateToThread({
        conversationIDKey: first.conversationIDKey,
        highlightMessageID,
        reason: 'previewResolved',
      })
    )
    return actions
  } catch (error) {
    if (
      error instanceof RPCError &&
      error.code === RPCTypes.StatusCode.scteamnotfound &&
      reason === 'appLink'
    ) {
      LinksConstants.useState
        .getState()
        .dispatch.setLinkError(
          "We couldn't find this team. Please check that you're a member of the team and the channel exists."
        )
      RouterConstants.useState.getState().dispatch.navigateAppend('keybaseLinkError')
      return
    } else {
      throw error
    }
  }
}

const openFolder = (_: unknown, action: Chat2Gen.OpenFolderPayload) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getConvoState(conversationIDKey).meta
  const participantInfo = Constants.getConvoState(conversationIDKey).participants
  const path = FsTypes.stringToPath(
    meta.teamType !== 'adhoc'
      ? ConfigConstants.teamFolder(meta.teamname)
      : ConfigConstants.privateFolderWithUsers(participantInfo.name)
  )
  return FsConstants.makeActionForOpenPathInFilesTab(path)
}

const downloadAttachment = async (
  downloadToCache: boolean,
  message: Types.Message,
  listenerApi: Container.ListenerApi
) => {
  try {
    const {conversationIDKey} = message
    const rpcRes = await RPCChatTypes.localDownloadFileAttachmentLocalRpcPromise({
      conversationID: Types.keyToConversationID(conversationIDKey),
      downloadToCache,
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      messageID: message.id,
      preview: false,
    })
    listenerApi.dispatch(Chat2Gen.createAttachmentDownloaded({message, path: rpcRes.filePath}))
    return rpcRes.filePath
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info(`downloadAttachment error: ${error.message}`)
      listenerApi.dispatch(
        Chat2Gen.createAttachmentDownloaded({error: error.message || 'Error downloading attachment', message})
      )
    } else {
      listenerApi.dispatch(
        Chat2Gen.createAttachmentDownloaded({error: 'Error downloading attachment', message})
      )
    }
    return false
  }
}

// Download an attachment to your device
const attachmentDownload = async (
  _: unknown,
  action: Chat2Gen.AttachmentDownloadPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey, ordinal} = action.payload

  const message = Constants.getConvoState(conversationIDKey).messageMap.get(ordinal)

  if (message?.type !== 'attachment') {
    throw new Error('Trying to download missing / incorrect message?')
  }

  // already downloaded?
  if (message.downloadPath) {
    logger.warn('Attachment already downloaded')
    return
  }

  await downloadAttachment(false, message, listenerApi)
}

const attachmentPreviewSelect = (_: unknown, action: Chat2Gen.AttachmentPreviewSelectPayload) => {
  RouterConstants.useState.getState().dispatch.navigateAppend({
    props: {
      conversationIDKey: action.payload.conversationIDKey,
      ordinal: action.payload.ordinal,
    },
    selected: 'chatAttachmentFullscreen',
  })
}

// Handle an image pasted into a conversation
const attachmentPasted = async (_: unknown, action: Chat2Gen.AttachmentPastedPayload) => {
  const {conversationIDKey, data} = action.payload
  const outboxID = Constants.generateOutboxID()
  const path = await RPCChatTypes.localMakeUploadTempFileRpcPromise({data, filename: 'paste.png', outboxID})

  const pathAndOutboxIDs = [{outboxID, path}]

  RouterConstants.useState.getState().dispatch.navigateAppend({
    props: {conversationIDKey, noDragDrop: true, pathAndOutboxIDs},
    selected: 'chatAttachmentGetTitles',
  })
}

const attachmentUploadCanceled = async (_: unknown, action: Chat2Gen.AttachmentUploadCanceledPayload) => {
  const {outboxIDs} = action.payload
  for (const outboxID of outboxIDs) {
    await RPCChatTypes.localCancelUploadTempFileRpcPromise({outboxID})
  }
}

const sendAudioRecording = async (_: unknown, action: Chat2Gen.SendAudioRecordingPayload) => {
  const {conversationIDKey, amps, path, duration} = action.payload
  const outboxID = Constants.generateOutboxID()
  const clientPrev = getClientPrev(conversationIDKey)
  const ephemeralLifetime = Constants.getConvoState(conversationIDKey).explodingMode
  const meta = Constants.getConvoState(conversationIDKey).meta
  if (meta.conversationIDKey !== conversationIDKey) {
    logger.warn('sendAudioRecording: no meta for send')
    return
  }

  let callerPreview: RPCChatTypes.MakePreviewRes | undefined
  if (amps) {
    callerPreview = await RPCChatTypes.localMakeAudioPreviewRpcPromise({amps, duration})
  }
  const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
  try {
    await RPCChatTypes.localPostFileAttachmentLocalNonblockRpcPromise({
      arg: {
        ...ephemeralData,
        callerPreview,
        conversationID: Types.keyToConversationID(conversationIDKey),
        filename: path,
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        metadata: Buffer.from([]),
        outboxID,
        title: '',
        tlfName: meta.tlfname,
        visibility: RPCTypes.TLFVisibility.private,
      },
      clientPrev,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.warn('sendAudioRecording: failed to send attachment: ' + error.message)
    }
  }
}

// Upload an attachment
const attachmentsUpload = async (_: unknown, action: Chat2Gen.AttachmentsUploadPayload) => {
  const {conversationIDKey, paths, titles} = action.payload
  let tlfName = action.payload.tlfName
  const meta = Constants.getConvoState(conversationIDKey).meta
  if (meta.conversationIDKey !== conversationIDKey) {
    if (!tlfName) {
      logger.warn('attachmentsUpload: missing meta for attachment upload', conversationIDKey)
      return
    }
  } else {
    tlfName = meta.tlfname
  }
  const clientPrev = getClientPrev(conversationIDKey)
  // disable sending exploding messages if flag is false
  const ephemeralLifetime = Constants.getConvoState(conversationIDKey).explodingMode
  const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
  const outboxIDs = paths.reduce<Array<Buffer>>((obids, p) => {
    obids.push(p.outboxID ? p.outboxID : Constants.generateOutboxID())
    return obids
  }, [])
  await Promise.all(
    paths.map(async (p, i) =>
      RPCChatTypes.localPostFileAttachmentLocalNonblockRpcPromise({
        arg: {
          ...ephemeralData,
          conversationID: Types.keyToConversationID(conversationIDKey),
          filename: Styles.unnormalizePath(p.path),
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          metadata: Buffer.from([]),
          outboxID: outboxIDs[i],
          title: titles[i] ?? '',
          tlfName: tlfName ?? '',
          visibility: RPCTypes.TLFVisibility.private,
        },
        clientPrev,
      })
    )
  )
}

const attachFromDragAndDrop = async (
  _: Container.TypedState,
  action: Chat2Gen.AttachFromDragAndDropPayload
) => {
  if (Platform.isDarwin && darwinCopyToChatTempUploadFile) {
    const paths = await Promise.all(
      action.payload.paths.map(async p => {
        const outboxID = Constants.generateOutboxID()
        const dst = await RPCChatTypes.localGetUploadTempFileRpcPromise({filename: p.path, outboxID})
        await darwinCopyToChatTempUploadFile(dst, p.path)
        return {outboxID, path: dst}
      })
    )

    return Chat2Gen.createAttachmentsUpload({
      conversationIDKey: action.payload.conversationIDKey,
      paths,
      titles: action.payload.titles,
    })
  }
  return Chat2Gen.createAttachmentsUpload({
    conversationIDKey: action.payload.conversationIDKey,
    paths: action.payload.paths,
    titles: action.payload.titles,
  })
}

// Tell service we're typing
const sendTyping = async (_: unknown, action: Chat2Gen.SendTypingPayload) => {
  const {conversationIDKey, typing} = action.payload
  await RPCChatTypes.localUpdateTypingRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    typing,
  })
}

// Implicit teams w/ reset users we can invite them back in or chat w/o them
const resetChatWithoutThem = (_: unknown, action: Chat2Gen.ResetChatWithoutThemPayload) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getConvoState(conversationIDKey).meta
  const participantInfo = Constants.getConvoState(conversationIDKey).participants
  // remove all bad people
  const goodParticipants = new Set(participantInfo.all)
  meta.resetParticipants.forEach(r => goodParticipants.delete(r))
  return Chat2Gen.createPreviewConversation({
    participants: [...goodParticipants],
    reason: 'resetChatWithoutThem',
  })
}

// let them back in after they reset
const resetLetThemIn = async (_: unknown, action: Chat2Gen.ResetLetThemInPayload) => {
  await RPCChatTypes.localAddTeamMemberAfterResetRpcPromise({
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
    username: action.payload.username,
  })
}

const markTeamAsRead = async (_: unknown, action: Chat2Gen.MarkTeamAsReadPayload) => {
  if (!ConfigConstants.useConfigState.getState().loggedIn) {
    logger.info('bail on not logged in')
    return
  }
  const tlfID = Buffer.from(TeamsTypes.teamIDToString(action.payload.teamID), 'hex')
  await RPCChatTypes.localMarkTLFAsReadLocalRpcPromise({
    tlfID,
  })
}

// Delete a message and any older
const deleteMessageHistory = async (_: unknown, action: Chat2Gen.MessageDeleteHistoryPayload) => {
  const {conversationIDKey} = action.payload
  const meta = Constants.getConvoState(conversationIDKey).meta

  if (!meta.tlfname) {
    logger.warn('Deleting message history for non-existent TLF:')
    return
  }

  await RPCChatTypes.localPostDeleteHistoryByAgeRpcPromise({
    age: 0,
    conversationID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    tlfName: meta.tlfname,
    tlfPublic: false,
  })
}

const dismissJourneycard = (_: unknown, action: Chat2Gen.DismissJourneycardPayload) => {
  const {cardType, conversationIDKey, ordinal} = action.payload
  RPCChatTypes.localDismissJourneycardRpcPromise({
    cardType: cardType,
    convID: Types.keyToConversationID(conversationIDKey),
  }).catch((error: unknown) => {
    if (error instanceof RPCError) {
      logger.error(`Failed to dismiss journeycard: ${error.message}`)
    }
  })
  return Chat2Gen.createMessagesWereDeleted({conversationIDKey, ordinals: [ordinal]})
}

const fetchUserEmoji = async (_: unknown, action: Chat2Gen.FetchUserEmojiPayload) => {
  const {conversationIDKey, onlyInTeam} = action.payload
  const results = await RPCChatTypes.localUserEmojisRpcPromise(
    {
      convID:
        conversationIDKey && conversationIDKey !== Constants.noConversationIDKey
          ? Types.keyToConversationID(conversationIDKey)
          : null,
      opts: {
        getAliases: true,
        getCreationInfo: false,
        onlyInTeam: onlyInTeam ?? false,
      },
    },
    Constants.waitingKeyLoadingEmoji
  )
  Constants.useState.getState().dispatch.loadedUserEmoji(results)
}

// Helpers to nav you to the right place
const navigateToInbox = (
  _: unknown,
  action: Chat2Gen.NavigateToInboxPayload | Chat2Gen.LeaveConversationPayload
) => {
  if (action.type === Chat2Gen.leaveConversation && action.payload.dontNavigateToInbox) {
    return
  }
  RouterConstants.useState.getState().dispatch.navUpToScreen('chatRoot')
  RouterConstants.useState.getState().dispatch.switchTab(Tabs.chatTab)
}

const navigateToThread = (_: unknown, action: Chat2Gen.NavigateToThreadPayload) => {
  const {conversationIDKey, reason} = action.payload
  // don't nav if its caused by a nav
  if (reason === 'navChanged') {
    return
  }
  const visible = RouterConstants.getVisibleScreen()
  // @ts-ignore TODO better types
  const visibleConvo: Types.ConversationIDKey | undefined = visible?.params?.conversationIDKey
  const visibleRouteName = visible?.name

  if (visibleRouteName !== Constants.threadRouteName && reason === 'findNewestConversation') {
    // service is telling us to change our selection but we're not looking, ignore
    return
  }

  // we select the chat tab and change the params
  if (Constants.isSplit) {
    RouterConstants.navToThread(conversationIDKey)
  } else {
    // immediately switch stack to an inbox | thread stack
    if (reason === 'push' || reason === 'savedLastState') {
      RouterConstants.navToThread(conversationIDKey)
      return
    } else {
      // replace if looking at the pending / waiting screen
      const replace =
        visibleRouteName === Constants.threadRouteName &&
        !Constants.isValidConversationIDKey(visibleConvo ?? '')
      // note: we don't switch tabs on non split
      const modalPath = RouterConstants.getModalStack()
      if (modalPath.length > 0) {
        RouterConstants.useState.getState().dispatch.clearModals()
      }
      RouterConstants.useState
        .getState()
        .dispatch.navigateAppend({props: {conversationIDKey}, selected: Constants.threadRouteName}, replace)
    }
  }
}

const ensureWidgetMetas = () => {
  const {inboxLayout} = Constants.useState.getState()
  if (!inboxLayout?.widgetList) {
    return
  }
  const missing = inboxLayout.widgetList.reduce<Array<Types.ConversationIDKey>>((l, v) => {
    if (Constants.getConvoState(v.convID).meta.conversationIDKey !== v.convID) {
      l.push(v.convID)
    }
    return l
  }, [])
  if (missing.length === 0) {
    return
  }

  Constants.useState.getState().dispatch.unboxRows(missing, true)
}

// Native share sheet for attachments
const mobileMessageAttachmentShare = async (
  _: Container.TypedState,
  action: Chat2Gen.MessageAttachmentNativeSharePayload,
  listenerApi: Container.ListenerApi
) => {
  const {message} = action.payload
  if (!message || message.type !== 'attachment') {
    throw new Error('Invalid share message')
  }
  const filePath = await downloadAttachment(true, message, listenerApi)
  if (!filePath) {
    logger.info('Downloading attachment failed')
    return
  }

  if (isIOS && message.fileName.endsWith('.pdf')) {
    RouterConstants.useState.getState().dispatch.navigateAppend({
      props: {
        message,
        // Prepend the 'file://' prefix here. Otherwise when webview
        // automatically does that, it triggers onNavigationStateChange
        // with the new address and we'd call stoploading().
        url: 'file://' + filePath,
      },
      selected: 'chatPDF',
    })
    return
  }

  try {
    await showShareActionSheet({filePath, mimeType: message.fileType})
  } catch (e) {
    logger.error('Failed to share attachment: ' + JSON.stringify(e))
  }
}

// Native save to camera roll
const mobileMessageAttachmentSave = async (
  _: Container.TypedState,
  action: Chat2Gen.MessageAttachmentNativeSavePayload,
  listenerApi: Container.ListenerApi
) => {
  const {message} = action.payload
  if (!message || message.type !== 'attachment') {
    throw new Error('Invalid share message')
  }
  const {conversationIDKey, ordinal, fileType} = message
  const fileName = await downloadAttachment(true, message, listenerApi)
  if (!fileName) {
    // failed to download
    logger.info('Downloading attachment failed')
    return
  }
  listenerApi.dispatch(Chat2Gen.createAttachmentMobileSave({conversationIDKey, ordinal}))
  try {
    logger.info('Trying to save chat attachment to camera roll')
    await saveAttachmentToCameraRoll(fileName, fileType)
  } catch (err) {
    logger.error('Failed to save attachment: ' + err)
    throw new Error('Failed to save attachment: ' + err)
  }
  listenerApi.dispatch(Chat2Gen.createAttachmentMobileSaved({conversationIDKey, ordinal}))
}

const joinConversation = async (_: unknown, action: Chat2Gen.JoinConversationPayload) => {
  await RPCChatTypes.localJoinConversationByIDLocalRpcPromise(
    {convID: Types.keyToConversationID(action.payload.conversationIDKey)},
    Constants.waitingKeyJoinConversation
  )
}

const leaveConversation = async (_: unknown, action: Chat2Gen.LeaveConversationPayload) => {
  await RPCChatTypes.localLeaveConversationLocalRpcPromise(
    {
      convID: Types.keyToConversationID(action.payload.conversationIDKey),
    },
    Constants.waitingKeyLeaveConversation
  )
}

const updateNotificationSettings = async (_: unknown, action: Chat2Gen.UpdateNotificationSettingsPayload) => {
  const {notificationsGlobalIgnoreMentions, notificationsMobile, notificationsDesktop} = action.payload
  const {conversationIDKey} = action.payload
  await RPCChatTypes.localSetAppNotificationSettingsLocalRpcPromise({
    channelWide: notificationsGlobalIgnoreMentions,
    convID: Types.keyToConversationID(conversationIDKey),
    settings: [
      {
        deviceType: RPCTypes.DeviceType.desktop,
        enabled: notificationsDesktop === 'onWhenAtMentioned',
        kind: RPCChatTypes.NotificationKind.atmention,
      },
      {
        deviceType: RPCTypes.DeviceType.desktop,
        enabled: notificationsDesktop === 'onAnyActivity',
        kind: RPCChatTypes.NotificationKind.generic,
      },
      {
        deviceType: RPCTypes.DeviceType.mobile,
        enabled: notificationsMobile === 'onWhenAtMentioned',
        kind: RPCChatTypes.NotificationKind.atmention,
      },
      {
        deviceType: RPCTypes.DeviceType.mobile,
        enabled: notificationsMobile === 'onAnyActivity',
        kind: RPCChatTypes.NotificationKind.generic,
      },
    ],
  })
}

const blockConversation = async (
  _: Container.TypedState,
  action: Chat2Gen.BlockConversationPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey, reportUser} = action.payload
  listenerApi.dispatch(Chat2Gen.createNavigateToInbox())
  ConfigConstants.useConfigState.getState().dispatch.dynamic.persistRoute?.()
  await RPCChatTypes.localSetConversationStatusLocalRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    status: reportUser ? RPCChatTypes.ConversationStatus.reported : RPCChatTypes.ConversationStatus.blocked,
  })
}

const hideConversation = async (
  _: Container.TypedState,
  action: Chat2Gen.HideConversationPayload,
  listenerApi: Container.ListenerApi
) => {
  const {conversationIDKey} = action.payload
  // Nav to inbox but don't use findNewConversation since changeSelectedConversation
  // does that with better information. It knows the conversation is hidden even before
  // that state bounces back.
  listenerApi.dispatch(Chat2Gen.createNavigateToInbox())
  Constants.useState.getState().dispatch.showInfoPanel(false)
  try {
    await RPCChatTypes.localSetConversationStatusLocalRpcPromise(
      {
        conversationID: Types.keyToConversationID(conversationIDKey),
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        status: RPCChatTypes.ConversationStatus.ignored,
      },
      Constants.waitingKeyConvStatusChange(conversationIDKey)
    )
  } catch (err) {
    logger.error('Failed to hide conversation: ' + err)
  }
}

const unhideConversation = async (_: Container.TypedState, action: Chat2Gen.UnhideConversationPayload) => {
  const {conversationIDKey} = action.payload
  try {
    await RPCChatTypes.localSetConversationStatusLocalRpcPromise(
      {
        conversationID: Types.keyToConversationID(conversationIDKey),
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        status: RPCChatTypes.ConversationStatus.unfiled,
      },
      Constants.waitingKeyConvStatusChange(conversationIDKey)
    )
  } catch (err) {
    logger.error('Failed to unhide conversation: ' + err)
  }
}

const setConvRetentionPolicy = async (_: unknown, action: Chat2Gen.SetConvRetentionPolicyPayload) => {
  const {conversationIDKey} = action.payload
  const convID = Types.keyToConversationID(conversationIDKey)
  let policy: RPCChatTypes.RetentionPolicy | undefined
  try {
    policy = TeamsConstants.retentionPolicyToServiceRetentionPolicy(action.payload.policy)
    if (policy) {
      await RPCChatTypes.localSetConvRetentionLocalRpcPromise({convID, policy})
      return
    }
  } catch (error) {
    if (error instanceof RPCError) {
      // should never happen
      logger.error(`Unable to parse retention policy: ${error.message}`)
    }
    throw error
  }
  return false
}

const toggleMessageCollapse = async (_: unknown, action: Chat2Gen.ToggleMessageCollapsePayload) => {
  const {conversationIDKey, messageID, ordinal} = action.payload
  const m = Constants.getConvoState(conversationIDKey).messageMap.get(ordinal)
  let isCollapsed = false

  if (messageID !== ordinal) {
    const unfurlInfos = [...(m?.unfurls?.values() ?? [])]
    const ui = unfurlInfos.find(u => u.unfurlMessageID === messageID)

    if (ui) {
      isCollapsed = ui.isCollapsed
    }
  } else {
    isCollapsed = m?.isCollapsed ?? false
  }
  await RPCChatTypes.localToggleMessageCollapseRpcPromise({
    collapse: !isCollapsed,
    convID: Types.keyToConversationID(conversationIDKey),
    msgID: messageID,
  })
}

// TODO This will break if you try to make 2 new conversations at the same time because there is
// only one pending conversation state.
// The fix involves being able to make multiple pending conversations
const createConversation = async (
  _: unknown,
  action: Chat2Gen.CreateConversationPayload,
  listenerApi: Container.ListenerApi
) => {
  const username = ConfigConstants.useCurrentUserState.getState().username
  if (!username) {
    logger.error('Making a convo while logged out?')
    return
  }
  try {
    const result = await RPCChatTypes.localNewConversationLocalRpcPromise(
      {
        identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
        membersType: RPCChatTypes.ConversationMembersType.impteamnative,
        tlfName: [...new Set([username, ...action.payload.participants])].join(','),
        tlfVisibility: RPCTypes.TLFVisibility.private,
        topicType: RPCChatTypes.TopicType.chat,
      },
      Constants.waitingKeyCreating
    )
    const {conv, uiConv} = result
    const conversationIDKey = Types.conversationIDToKey(conv.info.id)
    if (!conversationIDKey) {
      logger.warn("Couldn't make a new conversation?")
    } else {
      const meta = Constants.inboxUIItemToConversationMeta(uiConv)
      if (meta) {
        Constants.useState.getState().dispatch.metasReceived([meta])
      }

      const participantInfo: Types.ParticipantInfo = Constants.uiParticipantsToParticipantInfo(
        uiConv.participants ?? []
      )
      if (participantInfo.all.length > 0) {
        Constants.getConvoState(Types.stringToConversationIDKey(uiConv.convID)).dispatch.setParticipants(
          participantInfo
        )
      }
      listenerApi.dispatch(
        Chat2Gen.createNavigateToThread({
          conversationIDKey,
          highlightMessageID: action.payload.highlightMessageID,
          reason: 'justCreated',
        })
      )
    }
  } catch (error) {
    if (error instanceof RPCError) {
      const errUsernames = error.fields?.filter((elem: any) => elem.key === 'usernames') as
        | undefined
        | Array<{key: string; value: string}>
      let disallowedUsers: Array<string> = []
      if (errUsernames?.length) {
        const {value} = errUsernames[0] ?? {value: ''}
        disallowedUsers = value.split(',')
      }
      const allowedUsers = action.payload.participants.filter(x => !disallowedUsers?.includes(x))
      Constants.useState
        .getState()
        .dispatch.conversationErrored(allowedUsers, disallowedUsers, error.code, error.desc)
      listenerApi.dispatch(
        Chat2Gen.createNavigateToThread({
          conversationIDKey: Constants.pendingErrorConversationIDKey,
          highlightMessageID: action.payload.highlightMessageID,
          reason: 'justCreated',
        })
      )
    }
  }
}

const messageReplyPrivately = async (_: unknown, action: Chat2Gen.MessageReplyPrivatelyPayload) => {
  const {sourceConversationIDKey, ordinal} = action.payload
  const message = Constants.getConvoState(sourceConversationIDKey).messageMap.get(ordinal)
  if (!message) {
    logger.warn("messageReplyPrivately: can't find message to reply to", ordinal)
    return
  }

  const username = ConfigConstants.useCurrentUserState.getState().username
  if (!username) {
    throw new Error('messageReplyPrivately: making a convo while logged out?')
  }
  const result = await RPCChatTypes.localNewConversationLocalRpcPromise(
    {
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      membersType: RPCChatTypes.ConversationMembersType.impteamnative,
      tlfName: [...new Set([username, message.author])].join(','),
      tlfVisibility: RPCTypes.TLFVisibility.private,
      topicType: RPCChatTypes.TopicType.chat,
    },
    Constants.waitingKeyCreating
  )
  const conversationIDKey = Types.conversationIDToKey(result.conv.info.id)
  if (!conversationIDKey) {
    logger.warn("messageReplyPrivately: couldn't make a new conversation?")
    return
  }
  const meta = Constants.inboxUIItemToConversationMeta(result.uiConv)
  if (!meta) {
    logger.warn('messageReplyPrivately: unable to make meta')
    return
  }

  if (message.type !== 'text') {
    return
  }
  const text = new Container.HiddenString(Constants.formatTextForQuoting(message.text.stringValue()))

  Constants.getConvoState(conversationIDKey).dispatch.setUnsentText(text.stringValue())
  Constants.useState.getState().dispatch.metasReceived([meta])
  return [Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'createdMessagePrivately'})]
}

const toggleMessageReaction = async (_: unknown, action: Chat2Gen.ToggleMessageReactionPayload) => {
  // The service translates this to a delete if an identical reaction already exists
  // so we only need to call this RPC to toggle it on & off
  const {conversationIDKey, emoji, ordinal} = action.payload
  if (!emoji) {
    return
  }
  const message = Constants.getConvoState(conversationIDKey).messageMap.get(ordinal)
  if (!message) {
    logger.warn(`toggleMessageReaction: no message found`)
    return
  }
  const {type, exploded, id} = message
  if ((type === 'text' || type === 'attachment') && exploded) {
    logger.warn(`toggleMessageReaction: message is exploded`)
    return
  }
  const messageID = id
  const clientPrev = getClientPrev(conversationIDKey)
  const meta = Constants.getConvoState(conversationIDKey).meta
  const outboxID = Constants.generateOutboxID()
  logger.info(`toggleMessageReaction: posting reaction`)
  try {
    await RPCChatTypes.localPostReactionNonblockRpcPromise({
      body: emoji,
      clientPrev,
      conversationID: Types.keyToConversationID(conversationIDKey),
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      outboxID,
      supersedes: messageID,
      tlfName: meta.tlfname,
      tlfPublic: false,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info(`toggleMessageReaction: failed to post` + error.message)
    }
  }
}

const setMinWriterRole = async (_: unknown, action: Chat2Gen.SetMinWriterRolePayload) => {
  const {conversationIDKey, role} = action.payload
  logger.info(`Setting minWriterRole to ${role} for convID ${conversationIDKey}`)
  await RPCChatTypes.localSetConvMinWriterRoleLocalRpcPromise({
    convID: Types.keyToConversationID(conversationIDKey),
    role: RPCTypes.TeamRole[role],
  })
}

const unfurlRemove = async (_: unknown, action: Chat2Gen.UnfurlRemovePayload) => {
  const {conversationIDKey, messageID} = action.payload
  const meta = Constants.getConvoState(conversationIDKey).meta
  if (meta.conversationIDKey !== conversationIDKey) {
    logger.debug('unfurl remove no meta found, aborting!')
    return
  }
  await RPCChatTypes.localPostDeleteNonblockRpcPromise(
    {
      clientPrev: 0,
      conversationID: Types.keyToConversationID(conversationIDKey),
      identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
      outboxID: null,
      supersedes: messageID,
      tlfName: meta.tlfname,
      tlfPublic: false,
    },
    Constants.waitingKeyDeletePost
  )
}

const unfurlDismissPrompt = (_: unknown, action: Chat2Gen.UnfurlResolvePromptPayload) => {
  const {conversationIDKey, messageID, domain} = action.payload
  Constants.getConvoState(conversationIDKey).dispatch.unfurlTogglePrompt(messageID, domain, false)
}

const unfurlResolvePrompt = async (_: unknown, action: Chat2Gen.UnfurlResolvePromptPayload) => {
  const {conversationIDKey, messageID, result} = action.payload
  await RPCChatTypes.localResolveUnfurlPromptRpcPromise({
    convID: Types.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
    msgID: Types.messageIDToNumber(messageID),
    result,
  })
}

const unsentTextChanged = async (_: unknown, action: Chat2Gen.UnsentTextChangedPayload) => {
  const {conversationIDKey, text} = action.payload
  const meta = Constants.getConvoState(conversationIDKey).meta
  await RPCChatTypes.localUpdateUnsentTextRpcPromise({
    conversationID: Types.keyToConversationID(conversationIDKey),
    text: text.stringValue(),
    tlfName: meta.tlfname,
  })
}

const onGiphyResults = (_: unknown, action: EngineGen.Chat1ChatUiChatGiphySearchResultsPayload) => {
  const {convID, results} = action.payload.params
  Constants.getConvoState(Types.stringToConversationIDKey(convID)).dispatch.giphyGotSearchResult(results)
}

const onGiphyToggleWindow = (_: unknown, action: EngineGen.Chat1ChatUiChatGiphyToggleResultWindowPayload) => {
  const {convID, show, clearInput} = action.payload.params
  const conversationIDKey = Types.stringToConversationIDKey(convID)
  if (clearInput) {
    Constants.getConvoState(conversationIDKey).dispatch.setUnsentText('')
  }

  Constants.getConvoState(Types.stringToConversationIDKey(convID)).dispatch.giphyToggleWindow(show)
}

const resolveMaybeMention = async (_: unknown, action: Chat2Gen.ResolveMaybeMentionPayload) => {
  await RPCChatTypes.localResolveMaybeMentionRpcPromise({
    mention: {channel: action.payload.channel, name: action.payload.name},
  })
}

const pinMessage = async (_: unknown, action: Chat2Gen.PinMessagePayload) => {
  try {
    await RPCChatTypes.localPinMessageRpcPromise({
      convID: Types.keyToConversationID(action.payload.conversationIDKey),
      msgID: action.payload.messageID,
    })
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`pinMessage: ${error.message}`)
    }
  }
}

const unpinMessage = async (_: unknown, action: Chat2Gen.UnpinMessagePayload) => {
  try {
    await RPCChatTypes.localUnpinMessageRpcPromise(
      {convID: Types.keyToConversationID(action.payload.conversationIDKey)},
      Constants.waitingKeyUnpin(action.payload.conversationIDKey)
    )
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`unpinMessage: ${error.message}`)
    }
  }
}

const ignorePinnedMessage = async (_: unknown, action: Chat2Gen.IgnorePinnedMessagePayload) => {
  await RPCChatTypes.localIgnorePinnedMessageRpcPromise({
    convID: Types.keyToConversationID(action.payload.conversationIDKey),
  })
}

const openChatFromWidget = (
  _: unknown,
  {payload: {conversationIDKey}}: Chat2Gen.OpenChatFromWidgetPayload
) => {
  ConfigConstants.useConfigState.getState().dispatch.showMain()
  return [
    Chat2Gen.createNavigateToThread({
      conversationIDKey: conversationIDKey ?? Constants.noConversationIDKey,
      reason: 'inboxSmall',
    }),
  ]
}

const addUsersToChannel = async (_: unknown, action: Chat2Gen.AddUsersToChannelPayload) => {
  const {conversationIDKey, usernames} = action.payload

  try {
    await RPCChatTypes.localBulkAddToConvRpcPromise(
      {convID: Types.keyToConversationID(conversationIDKey), usernames},
      Constants.waitingKeyAddUsersToChannel
    )
    RouterConstants.useState.getState().dispatch.clearModals()
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`addUsersToChannel: ${error.message}`) // surfaced in UI via waiting key
    }
  }
}

const addUserToChannel = async (_: unknown, action: Chat2Gen.AddUserToChannelPayload) => {
  const {conversationIDKey, username} = action.payload
  try {
    await RPCChatTypes.localBulkAddToConvRpcPromise(
      {convID: Types.keyToConversationID(conversationIDKey), usernames: [username]},
      Constants.waitingKeyAddUserToChannel(username, conversationIDKey)
    )
    return Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'addedToChannel'})
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`addUserToChannel: ${error.message}`) // surfaced in UI via waiting key
    }
    return false
  }
}

const dismissBlockButtons = async (_: unknown, action: Chat2Gen.DismissBlockButtonsPayload) => {
  try {
    await RPCTypes.userDismissBlockButtonsRpcPromise({tlfID: action.payload.teamID})
  } catch (error) {
    if (error instanceof RPCError) {
      logger.error(`Couldn't dismiss block buttons: ${error.message}`)
    }
  }
}

const maybeChangeChatSelection = (
  prev: RouterConstants.State['navState'],
  next: RouterConstants.State['navState']
) => {
  const wasModal = prev && RouterConstants.getModalStack(prev).length > 0
  const isModal = next && RouterConstants.getModalStack(next).length > 0

  // ignore if changes involve a modal
  if (wasModal || isModal) {
    return
  }

  const p = RouterConstants.getVisibleScreen(prev)
  const n = RouterConstants.getVisibleScreen(next)

  const wasChat = p?.name === Constants.threadRouteName
  const isChat = n?.name === Constants.threadRouteName

  // nothing to do with chat
  if (!wasChat && !isChat) {
    return
  }

  // @ts-ignore TODO better param typing
  const wasID: Types.ConversationIDKey | undefined = p?.params?.conversationIDKey
  // @ts-ignore TODO better param typing
  const isID: Types.ConversationIDKey | undefined = n?.params?.conversationIDKey

  logger.info('maybeChangeChatSelection ', {isChat, isID, wasChat, wasID})

  // same? ignore
  if (wasChat && isChat && wasID === isID) {
    // if we've never loaded anything, keep going so we load it
    if (!isID || Constants.getConvoState(isID).containsLatestMessage !== undefined) {
      return
    }
  }

  // deselect if there was one
  const deselectAction = () => {
    if (wasChat && wasID && Constants.isValidConversationIDKey(wasID)) {
      reduxDispatch(Chat2Gen.createDeselectedConversation({conversationIDKey: wasID}))
    }
  }

  const reduxDispatch = Z.getReduxDispatch()
  // still chatting? just select new one
  if (wasChat && isChat && isID && Constants.isValidConversationIDKey(isID)) {
    deselectAction()
    Constants.getConvoState(isID).dispatch.selectedConversation()
    return
  }

  // leaving a chat
  if (wasChat && !isChat) {
    deselectAction()
    return
  }

  // going into a chat
  if (isChat && isID && Constants.isValidConversationIDKey(isID)) {
    deselectAction()
    Constants.getConvoState(isID).dispatch.selectedConversation()
    return
  }
}

const maybeChatTabSelected = (
  prev: RouterConstants.State['navState'],
  next: RouterConstants.State['navState']
) => {
  const reduxDispatch = Z.getReduxDispatch()
  if (RouterConstants.getTab(prev) !== Tabs.chatTab && RouterConstants.getTab(next) === Tabs.chatTab) {
    reduxDispatch(Chat2Gen.createTabSelected())
  }
}

const updateDraftState = (_: unknown, action: Chat2Gen.DeselectedConversationPayload) => {
  Constants.useState.getState().dispatch.unboxRows([action.payload.conversationIDKey], true)
}

const initChat = () => {
  // Platform specific actions
  if (Container.isMobile) {
    Container.listenAction(Chat2Gen.messageAttachmentNativeShare, mobileMessageAttachmentShare)
    Container.listenAction(Chat2Gen.messageAttachmentNativeSave, mobileMessageAttachmentSave)
  } else {
    Container.listenAction(Chat2Gen.desktopNotification, desktopNotify)
  }

  // Refresh the inbox
  Container.listenAction(EngineGen.chat1NotifyChatChatInboxStale, () => {
    Constants.useState.getState().dispatch.inboxRefresh('inboxStale')
  })

  // Actually try and unbox conversations
  Container.listenAction(EngineGen.chat1ChatUiChatInboxConversation, onGetInboxConvsUnboxed)
  Container.listenAction(EngineGen.chat1ChatUiChatInboxUnverified, onGetInboxUnverifiedConvs)
  Container.listenAction(EngineGen.chat1ChatUiChatInboxLayout, maybeChangeSelectedConv)
  Container.listenAction(EngineGen.chat1ChatUiChatInboxLayout, ensureWidgetMetas)
  // TODO move to engine constants
  Container.listenAction(EngineGen.chat1ChatUiChatInboxLayout, (_, action) => {
    Constants.useState.getState().dispatch.updateInboxLayout(action.payload.params.layout)
  })

  Container.listenAction(Chat2Gen.navigateToThread, (_, a) => {
    const id = a.payload.conversationIDKey
    const {dispatch} = Constants.getConvoState(id)
    let reason: string = a.payload.reason || 'navigated'
    let forceClear = false
    let forceContainsLatestCalc = false
    let messageIDControl: RPCChatTypes.MessageIDControl | undefined = undefined
    const knownRemotes = a.payload.pushBody && a.payload.pushBody.length > 0 ? [a.payload.pushBody] : []
    const centeredMessageIDs = a.payload.highlightMessageID
      ? [
          {
            conversationIDKey: id,
            highlightMode: 'flash' as const,
            messageID: a.payload.highlightMessageID,
          },
        ]
      : []

    if (a.payload.highlightMessageID) {
      reason = 'centered'
      messageIDControl = {
        mode: RPCChatTypes.MessageIDControlMode.centered,
        num: Constants.numMessagesOnInitialLoad,
        pivot: a.payload.highlightMessageID,
      }
      forceClear = true
      forceContainsLatestCalc = true
    }
    dispatch.loadMoreMessages({
      centeredMessageIDs,
      forceClear,
      forceContainsLatestCalc,
      knownRemotes,
      messageIDControl,
      reason,
    })
  })
  Container.listenAction(Chat2Gen.jumpToRecent, () => {
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.loadMoreMessages({forceClear: true, reason: 'jump to recent'})
  })
  Container.listenAction(Chat2Gen.loadOlderMessagesDueToScroll, () => {
    const {dispatch, moreToLoad} = Constants.getConvoState(Constants.getSelectedConversation())
    if (!moreToLoad) {
      logger.info('bail: scrolling back and at the end')
      return
    }
    dispatch.loadMoreMessages({
      numberOfMessagesToLoad: Constants.numMessagesOnScrollback,
      reason: '',
      scrollDirection: 'back',
    })
  })
  Container.listenAction(Chat2Gen.loadNewerMessagesDueToScroll, () => {
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.loadMoreMessages({
      numberOfMessagesToLoad: Constants.numMessagesOnScrollback,
      reason: 'scroll forward',
      scrollDirection: 'forward',
    })
  })
  Container.listenAction(Chat2Gen.loadMessagesCentered, (_, a) => {
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.loadMoreMessages({
      centeredMessageIDs: [
        {
          conversationIDKey: Constants.getSelectedConversation(),
          highlightMode: a.payload.highlightMode,
          messageID: a.payload.messageID,
        },
      ],
      forceClear: true,
      forceContainsLatestCalc: true,
      messageIDControl: {
        mode: RPCChatTypes.MessageIDControlMode.centered,
        num: Constants.numMessagesOnInitialLoad,
        pivot: a.payload.messageID,
      },
      reason: 'centered',
    })
  })
  Container.listenAction(Chat2Gen.markConversationsStale, (_, a) => {
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    // mentioned?
    if (a.payload.conversationIDKeys.includes(Constants.getSelectedConversation())) {
      dispatch.loadMoreMessages({reason: 'got stale'})
    }
  })
  Container.listenAction(Chat2Gen.tabSelected, () => {
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.loadMoreMessages({reason: 'tab selected'})
  })

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.appFocused === old.appFocused) return

    if (!Container.isMobile || !s.appFocused) {
      return
    }
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.loadMoreMessages({
      reason: 'foregrounding',
    })
    dispatch.markThreadAsRead()
  })

  Container.listenAction(Chat2Gen.messageSend, messageSend)
  Container.listenAction(Chat2Gen.messageSend, (_, a) => {
    const {conversationIDKey} = a.payload
    const {dispatch} = Constants.getConvoState(conversationIDKey)
    dispatch.setReplyTo(0)
    dispatch.setCommandMarkdown()
  })
  Container.listenAction(Chat2Gen.messageSendByUsernames, messageSendByUsernames)
  Container.listenAction(Chat2Gen.messageEdit, messageEdit)
  Container.listenAction(Chat2Gen.messageEdit, (_, action) => {
    Constants.getConvoState(action.payload.conversationIDKey).dispatch.setEditing(false)
  })
  Container.listenAction(Chat2Gen.messageDelete, messageDelete)
  Container.listenAction(Chat2Gen.messageDeleteHistory, deleteMessageHistory)
  Container.listenAction(Chat2Gen.dismissJourneycard, dismissJourneycard)
  Container.listenAction(Chat2Gen.confirmScreenResponse, confirmScreenResponse)

  // Giphy
  Container.listenAction(Chat2Gen.unsentTextChanged, unsentTextChanged)

  Container.listenAction(Chat2Gen.unfurlResolvePrompt, unfurlResolvePrompt)
  Container.listenAction(Chat2Gen.unfurlResolvePrompt, unfurlDismissPrompt)
  Container.listenAction(Chat2Gen.unfurlRemove, unfurlRemove)

  Container.listenAction(Chat2Gen.previewConversation, previewConversationTeam)
  Container.listenAction(Chat2Gen.previewConversation, previewConversationPersonMakesAConversation)
  Container.listenAction(Chat2Gen.openFolder, openFolder)

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.loadOnStartPhase === old.loadOnStartPhase) return
    switch (s.loadOnStartPhase) {
      case 'startupOrReloginButNotInARush': {
        // On login lets load the untrusted inbox. This helps make some flows easier
        if (ConfigConstants.useCurrentUserState.getState().username) {
          const {inboxRefresh} = Constants.useState.getState().dispatch
          inboxRefresh('bootstrap')
        }
        const f = async () => {
          const rows = await RPCTypes.configGuiGetValueRpcPromise({path: 'ui.inboxSmallRows'})
          const ri = rows?.i ?? -1
          if (ri > 0) {
            Constants.useState.getState().dispatch.setInboxNumSmallRows(ri, true)
          }
        }
        Z.ignorePromise(f())
        break
      }
      default:
    }
  })

  // Search handling
  Container.listenAction(Chat2Gen.attachmentPreviewSelect, attachmentPreviewSelect)
  Container.listenAction(Chat2Gen.attachmentDownload, attachmentDownload)
  Container.listenAction(Chat2Gen.attachmentsUpload, attachmentsUpload)
  Container.listenAction(Chat2Gen.attachFromDragAndDrop, attachFromDragAndDrop)
  Container.listenAction(Chat2Gen.attachmentPasted, attachmentPasted)
  Container.listenAction(Chat2Gen.attachmentUploadCanceled, attachmentUploadCanceled)

  Container.listenAction(Chat2Gen.sendTyping, sendTyping)
  Container.listenAction(Chat2Gen.resetChatWithoutThem, resetChatWithoutThem)
  Container.listenAction(Chat2Gen.resetLetThemIn, resetLetThemIn)

  Container.listenAction(Chat2Gen.messagesAdd, () => {
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.markThreadAsRead()
  })
  Container.listenAction(Chat2Gen.updateUnreadline, (_, a) => {
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.markThreadAsRead(a.payload.messageID)
  })
  Container.listenAction(Chat2Gen.markInitiallyLoadedThreadAsRead, (_, a) => {
    const conversationIDKey = Constants.getSelectedConversation()
    if (a.payload.conversationIDKey !== conversationIDKey) {
      logger.info('bail on not looking at this thread anymore?')
      return
    }
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.markThreadAsRead()
  })
  Container.listenAction(Chat2Gen.tabSelected, () => {
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.markThreadAsRead()
  })

  Container.listenAction(Chat2Gen.markTeamAsRead, markTeamAsRead)
  Container.listenAction(Chat2Gen.leaveConversation, () => {
    RouterConstants.useState.getState().dispatch.clearModals()
  })
  Container.listenAction([Chat2Gen.navigateToInbox, Chat2Gen.leaveConversation], navigateToInbox)
  Container.listenAction(Chat2Gen.navigateToThread, navigateToThread)
  Container.listenAction(Chat2Gen.navigateToThread, (_, action) => {
    const {conversationIDKey} = action.payload
    Constants.getConvoState(conversationIDKey).dispatch.hideSearch()
  })

  Container.listenAction(Chat2Gen.joinConversation, joinConversation)
  Container.listenAction(Chat2Gen.leaveConversation, leaveConversation)

  Container.listenAction(Chat2Gen.updateNotificationSettings, updateNotificationSettings)
  Container.listenAction(Chat2Gen.blockConversation, blockConversation)
  Container.listenAction(Chat2Gen.hideConversation, hideConversation)
  Container.listenAction(Chat2Gen.unhideConversation, unhideConversation)

  Container.listenAction(Chat2Gen.setConvRetentionPolicy, setConvRetentionPolicy)
  Container.listenAction(Chat2Gen.toggleMessageCollapse, toggleMessageCollapse)
  Container.listenAction(Chat2Gen.createConversation, createConversation)
  Container.listenAction(Chat2Gen.messageReplyPrivately, messageReplyPrivately)
  Container.listenAction(Chat2Gen.openChatFromWidget, openChatFromWidget)

  Container.listenAction(Chat2Gen.toggleMessageReaction, toggleMessageReaction)

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.badgeState === old.badgeState) return
    if (!s.badgeState) return
    s.badgeState.conversations?.forEach(c => {
      const id = Types.conversationIDToKey(c.convID)
      Constants.getConvoState(id).dispatch.badgesUpdated(c.badgeCount)
      Constants.getConvoState(id).dispatch.unreadUpdated(c.unreadMessages)
    })
    Constants.useState
      .getState()
      .dispatch.badgesUpdated(s.badgeState.bigTeamBadgeCount, s.badgeState.smallTeamBadgeCount)
  })

  Container.listenAction(Chat2Gen.setMinWriterRole, setMinWriterRole)

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.gregorPushState === old.gregorPushState) return
    Constants.useState.getState().dispatch.updatedGregor(s.gregorPushState)
  })

  Container.listenAction(Chat2Gen.channelSuggestionsTriggered, (_, action) => {
    const {conversationIDKey} = action.payload
    const meta = Constants.getConvoState(conversationIDKey).meta
    // If this is an impteam, try to refresh mutual team info
    if (!meta.teamname) {
      Constants.getConvoState(conversationIDKey).dispatch.refreshMutualTeamsInConv()
    }
  })

  Container.listenAction(Chat2Gen.fetchUserEmoji, fetchUserEmoji)

  Container.listenAction(Chat2Gen.addUsersToChannel, addUsersToChannel)
  Container.listenAction(Chat2Gen.addUserToChannel, addUserToChannel)

  Container.listenAction(EngineGen.chat1NotifyChatChatPromptUnfurl, onChatPromptUnfurl)
  Container.listenAction(EngineGen.chat1NotifyChatChatIdentifyUpdate, onChatIdentifyUpdate)
  Container.listenAction(EngineGen.chat1NotifyChatChatInboxSyncStarted, onChatInboxSyncStarted)
  Container.listenAction(EngineGen.chat1NotifyChatChatInboxSynced, onChatInboxSynced)
  Container.listenAction(EngineGen.chat1NotifyChatChatPaymentInfo, onChatPaymentInfo)
  Container.listenAction(EngineGen.chat1NotifyChatChatRequestInfo, onChatRequestInfo)
  Container.listenAction(EngineGen.chat1NotifyChatChatSubteamRename, onChatSubteamRename)
  Container.listenAction(EngineGen.chat1NotifyChatChatTLFFinalize, onChatChatTLFFinalizePayload)
  Container.listenAction(EngineGen.chat1NotifyChatChatThreadsStale, onChatThreadStale)
  Container.listenAction(EngineGen.chat1ChatUiChatGiphySearchResults, onGiphyResults)
  Container.listenAction(EngineGen.chat1ChatUiChatGiphyToggleResultWindow, onGiphyToggleWindow)
  Container.listenAction(EngineGen.chat1ChatUiChatShowManageChannels, (_, action) => {
    const {teamname} = action.payload.params
    const teamID = TeamsConstants.useState.getState().teamNameToID.get(teamname) ?? TeamsTypes.noTeamID
    TeamsConstants.useState.getState().dispatch.manageChatChannels(teamID)
  })
  Container.listenAction(EngineGen.chat1ChatUiChatCoinFlipStatus, (_, action) => {
    const {statuses} = action.payload.params
    Constants.useState.getState().dispatch.updateCoinFlipStatus(statuses || [])
  })
  Container.listenAction(EngineGen.chat1ChatUiChatCommandMarkdown, (_, action) => {
    const {convID, md} = action.payload.params
    const conversationIDKey = Types.stringToConversationIDKey(convID)
    Constants.getConvoState(conversationIDKey).dispatch.setCommandMarkdown(md || undefined)
  })
  Container.listenAction(EngineGen.chat1ChatUiChatCommandStatus, (_, action) => {
    const {convID, displayText, typ, actions} = action.payload.params
    const conversationIDKey = Types.stringToConversationIDKey(convID)
    Constants.getConvoState(conversationIDKey).dispatch.setCommandStatusInfo({
      actions: actions || [],
      displayText,
      displayType: typ,
    })
  })
  Container.listenAction(EngineGen.chat1ChatUiChatMaybeMentionUpdate, (_, action) => {
    const {teamName, channel, info} = action.payload.params
    Constants.useState
      .getState()
      .dispatch.setMaybeMentionInfo(Constants.getTeamMentionName(teamName, channel), info)
  })

  Container.listenAction(Chat2Gen.replyJump, onReplyJump)

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    if (s.mobileAppState === 'background' && Constants.useState.getState().inboxSearch) {
      Constants.useState.getState().dispatch.toggleInboxSearch(false)
    }
  })

  Container.listenAction(Chat2Gen.resolveMaybeMention, resolveMaybeMention)

  Container.listenAction(Chat2Gen.pinMessage, pinMessage)
  Container.listenAction(Chat2Gen.unpinMessage, unpinMessage)
  Container.listenAction(Chat2Gen.ignorePinnedMessage, ignorePinnedMessage)

  Container.listenAction(Chat2Gen.sendAudioRecording, sendAudioRecording)

  Container.listenAction(Chat2Gen.dismissBlockButtons, dismissBlockButtons)

  Container.listenAction(EngineGen.chat1NotifyChatChatConvUpdate, onChatConvUpdate)

  Container.listenAction(EngineGen.chat1ChatUiChatBotCommandsUpdateStatus, (_, a) => {
    const {convID, status} = a.payload.params
    const conversationIDKey = Types.stringToConversationIDKey(convID)
    Constants.getConvoState(conversationIDKey).dispatch.botCommandsUpdateStatus(status)
  })

  RouterConstants.useState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    maybeChangeChatSelection(prev, next)
    maybeChatTabSelected(prev, next)
  })

  Container.listenAction(Chat2Gen.deselectedConversation, updateDraftState)

  ConfigConstants.useDaemonState.subscribe((s, old) => {
    if (s.handshakeVersion === old.handshakeVersion) return
    Constants.useState.getState().dispatch.loadStaticConfig()
  })

  Container.listenAction(EngineGen.chat1NotifyChatChatParticipantsInfo, (_, a) => {
    const {participants: participantMap} = a.payload.params
    Object.keys(participantMap).forEach(convIDStr => {
      const participants = participantMap[convIDStr]
      const conversationIDKey = Types.stringToConversationIDKey(convIDStr)
      if (participants) {
        Constants.getConvoState(conversationIDKey).dispatch.setParticipants(
          Constants.uiParticipantsToParticipantInfo(participants)
        )
      }
    })
  })

  Container.listenAction(EngineGen.chat1NotifyChatChatAttachmentDownloadProgress, (_, a) => {
    const {convID, msgID, bytesComplete, bytesTotal} = a.payload.params
    const conversationIDKey = Types.conversationIDToKey(convID)
    const ratio = bytesComplete / bytesTotal
    Constants.getConvoState(conversationIDKey).dispatch.updateAttachmentViewTransfer(msgID, ratio)
  })

  Container.listenAction(Chat2Gen.attachmentDownloaded, (_, a) => {
    const {message, path} = a.payload
    const {conversationIDKey} = message
    Constants.getConvoState(conversationIDKey).dispatch.updateAttachmentViewTransfered(message.id, path ?? '')
  })

  Container.listenAction([Chat2Gen.replyJump, Chat2Gen.jumpToRecent], (_, a) => {
    const {conversationIDKey} = a.payload
    Constants.getConvoState(conversationIDKey).dispatch.setMessageCenterOrdinal()
  })

  Container.listenAction(Chat2Gen.messagesAdd, (_, a) => {
    a.payload.centeredMessageIDs?.forEach(cm => {
      const ordinal = Types.numberToOrdinal(Types.messageIDToNumber(cm.messageID))
      Constants.getConvoState(cm.conversationIDKey).dispatch.setMessageCenterOrdinal({
        highlightMode: cm.highlightMode,
        ordinal,
      })
    })
  })
}

export default initChat
