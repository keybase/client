import * as Chat2Gen from './chat2-gen'
import * as ConfigConstants from '../constants/config'
import * as RouterConstants from '../constants/router2'
import * as UsersConstants from '../constants/users'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from './../constants/types/rpc-gen'
import * as Tabs from '../constants/tabs'
import * as TeamsConstants from '../constants/teams'
import * as TeamsTypes from '../constants/types/teams'
import * as Types from '../constants/types/chat2'
import * as WaitingConstants from '../constants/waiting'
import {findLast} from '../util/arrays'
import logger from '../logger'
import {RPCError} from '../util/errors'

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
      const items = syncRes.incremental.items || []
      const selectedConversation = Constants.getSelectedConversation()
      let loadMore = false
      const metas = items.reduce<Array<Types.ConversationMeta>>((arr, i) => {
        const meta = Constants.unverifiedInboxUIItemToConversationMeta(i.conv)
        if (meta) {
          arr.push(meta)
          if (meta.conversationIDKey === selectedConversation) {
            loadMore = true
          }
        }
        return arr
      }, [])
      if (loadMore) {
        Constants.getConvoState(selectedConversation).dispatch.loadMoreMessages({reason: 'got stale'})
      }
      const removals = syncRes.incremental.removals?.map(Types.stringToConversationIDKey)
      // Update new untrusted
      if (metas.length || removals?.length) {
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
  const keys = ['clear', 'newactivity'] as const
  if (__DEV__) {
    if (keys.length * 2 !== Object.keys(RPCChatTypes.StaleUpdateType).length) {
      throw new Error('onChatThreadStale invalid enum')
    }
  }
  let loadMore = false
  const selectedConversation = Constants.getSelectedConversation()
  keys.forEach(key => {
    const conversationIDKeys = (updates || []).reduce<Array<string>>((arr, u) => {
      const cid = Types.conversationIDToKey(u.convID)
      if (u.updateType === RPCChatTypes.StaleUpdateType[key]) {
        arr.push(cid)
      }
      // mentioned?
      if (cid === selectedConversation) {
        loadMore = true
      }
      return arr
    }, [])
    // load the inbox instead
    if (conversationIDKeys.length > 0) {
      logger.info(
        `onChatThreadStale: dispatching thread reload actions for ${conversationIDKeys.length} convs of type ${key}`
      )

      Constants.useState.getState().dispatch.unboxRows(conversationIDKeys, true)

      if (RPCChatTypes.StaleUpdateType[key] === RPCChatTypes.StaleUpdateType.clear) {
        conversationIDKeys.forEach(convID =>
          Constants.getConvoState(convID).dispatch.replaceMessageMap(new Map())
        )
        conversationIDKeys.forEach(convID => Constants.getConvoState(convID).dispatch.setMessageOrdinals())
      }
    }
  })
  if (loadMore) {
    const {dispatch} = Constants.getConvoState(selectedConversation)
    dispatch.loadMoreMessages({reason: 'got stale'})
  }
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

type StellarConfirmWindowResponse = {result: (b: boolean) => void}
let _stellarConfirmWindowResponse: StellarConfirmWindowResponse | undefined

function storeStellarConfirmWindowResponse(accept: boolean, response?: StellarConfirmWindowResponse) {
  _stellarConfirmWindowResponse?.result(accept)
  _stellarConfirmWindowResponse = response
}

const confirmScreenResponse = (_: unknown, action: Chat2Gen.ConfirmScreenResponsePayload) => {
  storeStellarConfirmWindowResponse(action.payload.accept)
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
  Constants.getConvoState(conversationIDKey).dispatch.messagesWereDeleted({ordinals: [ordinal]})
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

const onGiphyResults = (_: unknown, action: EngineGen.Chat1ChatUiChatGiphySearchResultsPayload) => {
  const {convID, results} = action.payload.params
  Constants.getConvoState(Types.stringToConversationIDKey(convID)).dispatch.giphyGotSearchResult(results)
}

const onGiphyToggleWindow = (_: unknown, action: EngineGen.Chat1ChatUiChatGiphyToggleResultWindowPayload) => {
  const {convID, show, clearInput} = action.payload.params
  const conversationIDKey = Types.stringToConversationIDKey(convID)
  if (clearInput) {
    Constants.getConvoState(conversationIDKey).dispatch.injectIntoInput('')
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

const initChat = () => {
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
    const centeredMessageID = a.payload.highlightMessageID
      ? {
          conversationIDKey: id,
          highlightMode: 'flash' as const,
          messageID: a.payload.highlightMessageID,
        }
      : undefined

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
      centeredMessageID,
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
  Container.listenAction(Chat2Gen.tabSelected, () => {
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.loadMoreMessages({reason: 'tab selected'})
  })

  Container.listenAction(Chat2Gen.dismissJourneycard, dismissJourneycard)
  Container.listenAction(Chat2Gen.confirmScreenResponse, confirmScreenResponse)

  Container.listenAction(Chat2Gen.unfurlResolvePrompt, unfurlResolvePrompt)
  Container.listenAction(Chat2Gen.unfurlResolvePrompt, unfurlDismissPrompt)
  Container.listenAction(Chat2Gen.unfurlRemove, unfurlRemove)

  // Search handling
  Container.listenAction(Chat2Gen.attachmentPasted, attachmentPasted)
  Container.listenAction(Chat2Gen.attachmentUploadCanceled, attachmentUploadCanceled)

  Container.listenAction(Chat2Gen.updateUnreadline, (_, a) => {
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.markThreadAsRead(a.payload.messageID)
  })
  Container.listenAction(Chat2Gen.tabSelected, () => {
    const {dispatch} = Constants.getConvoState(Constants.getSelectedConversation())
    dispatch.markThreadAsRead()
  })

  Container.listenAction(Chat2Gen.navigateToInbox, () => {
    RouterConstants.useState.getState().dispatch.navUpToScreen('chatRoot')
    RouterConstants.useState.getState().dispatch.switchTab(Tabs.chatTab)
  })
  Container.listenAction(Chat2Gen.navigateToThread, navigateToThread)
  Container.listenAction(Chat2Gen.navigateToThread, (_, action) => {
    const {conversationIDKey} = action.payload
    Constants.getConvoState(conversationIDKey).dispatch.hideSearch()
  })

  Container.listenAction(Chat2Gen.updateNotificationSettings, updateNotificationSettings)

  Container.listenAction(Chat2Gen.toggleMessageCollapse, toggleMessageCollapse)
  Container.listenAction(Chat2Gen.openChatFromWidget, openChatFromWidget)

  Container.listenAction(Chat2Gen.setMinWriterRole, setMinWriterRole)

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

  Container.listenAction(Chat2Gen.replyJump, (_, action) => {
    Constants.getConvoState(action.payload.conversationIDKey).dispatch.loadMessagesCentered(
      action.payload.messageID,
      'flash'
    )
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

  Container.listenAction([Chat2Gen.replyJump, Chat2Gen.jumpToRecent], (_, a) => {
    const {conversationIDKey} = a.payload
    Constants.getConvoState(conversationIDKey).dispatch.setMessageCenterOrdinal()
  })

  // Backend gives us messageIDs sometimes so we need to find our ordinal
  const messageIDToOrdinal = (
    map: Constants.ConvoState['messageMap'],
    pendingOutboxToOrdinal: Constants.ConvoState['pendingOutboxToOrdinal'] | undefined,
    messageID: Types.MessageID
  ) => {
    // A message we didn't send in this session?
    let m = map.get(Types.numberToOrdinal(messageID))
    if (m?.id !== 0 && m?.id === messageID) {
      return m.ordinal
    }
    // Search through our sent messages
    const pendingOrdinal = [...(pendingOutboxToOrdinal?.values() ?? [])].find(o => {
      m = map?.get(o)
      if (m?.id !== 0 && m?.id === messageID) {
        return true
      }
      return false
    })

    if (pendingOrdinal) {
      return pendingOrdinal
    }

    return null
  }
  Container.listenAction(EngineGen.chat1NotifyChatChatAttachmentDownloadComplete, (_, action) => {
    const {convID, msgID} = action.payload.params
    const conversationIDKey = Types.conversationIDToKey(convID)
    const {pendingOutboxToOrdinal, dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
    const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, msgID)
    if (!ordinal) {
      logger.info(
        `downloadComplete: no ordinal found: conversationIDKey: ${conversationIDKey} msgID: ${msgID}`
      )
      return
    }
    const message = messageMap.get(ordinal)
    if (!message) {
      logger.info(
        `downloadComplete: no message found: conversationIDKey: ${conversationIDKey} ordinal: ${ordinal}`
      )
      return
    }
    if (message?.type === 'attachment') {
      dispatch.updateMessage(ordinal, {
        transferProgress: 0,
        transferState: undefined,
      })
    }
  })
  Container.listenAction(EngineGen.chat1NotifyChatChatAttachmentDownloadProgress, (_, action) => {
    const {convID, msgID, bytesComplete, bytesTotal} = action.payload.params
    const conversationIDKey = Types.conversationIDToKey(convID)
    const {pendingOutboxToOrdinal, dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
    const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, msgID)
    if (!ordinal) {
      logger.info(
        `downloadProgress: no ordinal found: conversationIDKey: ${conversationIDKey} msgID: ${msgID}`
      )
      return
    }
    const message = messageMap.get(ordinal)
    if (!message) {
      logger.info(
        `downloadProgress: no message found: conversationIDKey: ${conversationIDKey} ordinal: ${ordinal}`
      )
      return
    }
    const ratio = bytesComplete / bytesTotal

    const m = messageMap.get(message.ordinal)
    if (m?.type === 'attachment') {
      dispatch.updateMessage(ordinal, {
        transferErrMsg: undefined,
        transferProgress: ratio,
        transferState: 'downloading',
      })
    }
  })
}

export default initChat
