import * as C from '../constants'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as TeamsTypes from '../constants/types/teams'
import * as Types from '../constants/types/chat2'
import logger from '../logger'

// Some participants are broken/fixed now
const onChatIdentifyUpdate = (_: unknown, action: EngineGen.Chat1NotifyChatChatIdentifyUpdatePayload) => {
  const {update} = action.payload.params
  const usernames = update.CanonicalName.split(',')
  const broken = (update.breaks.breaks || []).map(b => b.user.username)
  const updates = usernames.map(name => ({info: {broken: broken.includes(name)}, name}))
  C.useUsersState.getState().dispatch.updates(updates)
}

const onChatPromptUnfurl = (_: unknown, action: EngineGen.Chat1NotifyChatChatPromptUnfurlPayload) => {
  const {convID, domain, msgID} = action.payload.params
  C.getConvoState(Types.conversationIDToKey(convID)).dispatch.unfurlTogglePrompt(
    Types.numberToMessageID(msgID),
    domain,
    true
  )
}

const onChatInboxSyncStarted = () => {
  const {increment} = C.useWaitingState.getState().dispatch
  increment(Constants.waitingKeyInboxSyncStarted)
}

// Service tells us it's done syncing
const onChatInboxSynced = (
  _state: Container.TypedState,
  action: EngineGen.Chat1NotifyChatChatInboxSyncedPayload
) => {
  const {syncRes} = action.payload.params

  const {clear} = C.useWaitingState.getState().dispatch
  const {inboxRefresh} = C.useChatState.getState().dispatch
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
      const selectedConversation = C.getSelectedConversation()
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
        C.getConvoState(selectedConversation).dispatch.loadMoreMessages({reason: 'got stale'})
      }
      const removals = syncRes.incremental.removals?.map(Types.stringToConversationIDKey)
      // Update new untrusted
      if (metas.length || removals?.length) {
        C.useChatState.getState().dispatch.metasReceived(metas, removals)
      }

      C.useChatState.getState().dispatch.unboxRows(
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
  const conversationIDKey = convID ? Types.conversationIDToKey(convID) : C.noConversationIDKey
  const paymentInfo = Constants.uiPaymentInfoToChatPaymentInfo([info])
  if (!paymentInfo) {
    // This should never happen
    const errMsg = `got 'NotifyChat.ChatPaymentInfo' with no valid paymentInfo for convID ${conversationIDKey} messageID: ${msgID}. The local version may be absent or out of date.`
    logger.error(errMsg)
    throw new Error(errMsg)
  }
  C.useChatState.getState().dispatch.paymentInfoReceived(paymentInfo)
  C.getConvoState(conversationIDKey).dispatch.paymentInfoReceived(msgID, paymentInfo)
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
  C.getConvoState(conversationIDKey).dispatch.requestInfoReceived(msgID, requestInfo)
}

const onChatSubteamRename = (_: unknown, action: EngineGen.Chat1NotifyChatChatSubteamRenamePayload) => {
  const {convs} = action.payload.params
  const conversationIDKeys = (convs ?? []).map(c => Types.stringToConversationIDKey(c.convID))
  C.useChatState.getState().dispatch.unboxRows(conversationIDKeys, true)
}

const onChatChatTLFFinalizePayload = (
  _: unknown,
  action: EngineGen.Chat1NotifyChatChatTLFFinalizePayload
) => {
  const {convID} = action.payload.params
  C.useChatState.getState().dispatch.unboxRows([Types.conversationIDToKey(convID)])
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
  const selectedConversation = C.getSelectedConversation()
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

      C.useChatState.getState().dispatch.unboxRows(conversationIDKeys, true)

      if (RPCChatTypes.StaleUpdateType[key] === RPCChatTypes.StaleUpdateType.clear) {
        conversationIDKeys.forEach(convID => C.getConvoState(convID).dispatch.replaceMessageMap(new Map()))
        conversationIDKeys.forEach(convID => C.getConvoState(convID).dispatch.setMessageOrdinals())
      }
    }
  })
  if (loadMore) {
    const {dispatch} = C.getConvoState(selectedConversation)
    dispatch.loadMoreMessages({reason: 'got stale'})
  }
}

const onChatConvUpdate = (_: unknown, action: EngineGen.Chat1NotifyChatChatConvUpdatePayload) => {
  const {conv} = action.payload.params
  if (conv) {
    const meta = Constants.inboxUIItemToConversationMeta(conv)
    if (meta) {
      C.useChatState.getState().dispatch.metasReceived([meta])
    }
  }
}

const onGiphyResults = (_: unknown, action: EngineGen.Chat1ChatUiChatGiphySearchResultsPayload) => {
  const {convID, results} = action.payload.params
  C.getConvoState(Types.stringToConversationIDKey(convID)).dispatch.giphyGotSearchResult(results)
}

const onGiphyToggleWindow = (_: unknown, action: EngineGen.Chat1ChatUiChatGiphyToggleResultWindowPayload) => {
  const {convID, show, clearInput} = action.payload.params
  const conversationIDKey = Types.stringToConversationIDKey(convID)
  if (clearInput) {
    C.getConvoState(conversationIDKey).dispatch.injectIntoInput('')
  }

  C.getConvoState(Types.stringToConversationIDKey(convID)).dispatch.giphyToggleWindow(show)
}

const initChat = () => {
  // TODO move to engine constants
  Container.listenAction(EngineGen.chat1ChatUiChatInboxLayout, (_, action) => {
    C.useChatState.getState().dispatch.updateInboxLayout(action.payload.params.layout)
  })

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
    const teamID = C.useTeamsState.getState().teamNameToID.get(teamname) ?? TeamsTypes.noTeamID
    C.useTeamsState.getState().dispatch.manageChatChannels(teamID)
  })
  Container.listenAction(EngineGen.chat1ChatUiChatCoinFlipStatus, (_, action) => {
    const {statuses} = action.payload.params
    C.useChatState.getState().dispatch.updateCoinFlipStatus(statuses || [])
  })
  Container.listenAction(EngineGen.chat1ChatUiChatCommandMarkdown, (_, action) => {
    const {convID, md} = action.payload.params
    const conversationIDKey = Types.stringToConversationIDKey(convID)
    C.getConvoState(conversationIDKey).dispatch.setCommandMarkdown(md || undefined)
  })
  Container.listenAction(EngineGen.chat1ChatUiChatCommandStatus, (_, action) => {
    const {convID, displayText, typ, actions} = action.payload.params
    const conversationIDKey = Types.stringToConversationIDKey(convID)
    C.getConvoState(conversationIDKey).dispatch.setCommandStatusInfo({
      actions: actions || [],
      displayText,
      displayType: typ,
    })
  })
  Container.listenAction(EngineGen.chat1ChatUiChatMaybeMentionUpdate, (_, action) => {
    const {teamName, channel, info} = action.payload.params
    C.useChatState
      .getState()
      .dispatch.setMaybeMentionInfo(Constants.getTeamMentionName(teamName, channel), info)
  })

  Container.listenAction(EngineGen.chat1NotifyChatChatConvUpdate, onChatConvUpdate)

  Container.listenAction(EngineGen.chat1ChatUiChatBotCommandsUpdateStatus, (_, a) => {
    const {convID, status} = a.payload.params
    const conversationIDKey = Types.stringToConversationIDKey(convID)
    C.getConvoState(conversationIDKey).dispatch.botCommandsUpdateStatus(status)
  })

  Container.listenAction(EngineGen.chat1NotifyChatChatParticipantsInfo, (_, a) => {
    const {participants: participantMap} = a.payload.params
    Object.keys(participantMap).forEach(convIDStr => {
      const participants = participantMap[convIDStr]
      const conversationIDKey = Types.stringToConversationIDKey(convIDStr)
      if (participants) {
        C.getConvoState(conversationIDKey).dispatch.setParticipants(
          Constants.uiParticipantsToParticipantInfo(participants)
        )
      }
    })
  })

  Container.listenAction(EngineGen.chat1NotifyChatChatAttachmentDownloadProgress, (_, a) => {
    const {convID, msgID, bytesComplete, bytesTotal} = a.payload.params
    const conversationIDKey = Types.conversationIDToKey(convID)
    const ratio = bytesComplete / bytesTotal
    C.getConvoState(conversationIDKey).dispatch.updateAttachmentViewTransfer(msgID, ratio)
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
    const {pendingOutboxToOrdinal, dispatch, messageMap} = C.getConvoState(conversationIDKey)
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
    const {pendingOutboxToOrdinal, dispatch, messageMap} = C.getConvoState(conversationIDKey)
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
