import * as Chat2Gen from '../actions/chat2-gen'
import * as BotsGen from '../actions/bots-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/chat2'
import type * as TeamBuildingGen from '../actions/team-building-gen'
import type * as RPCTypes from '../constants/types/rpc-gen'
import type * as TeamTypes from '../constants/types/teams'
import {editTeambuildingDraft} from './team-building'
import {teamBuilderReducerCreator} from '../team-building/reducer-helper'
import logger from '../logger'
import HiddenString from '../util/hidden-string'
import partition from 'lodash/partition'
import shallowEqual from 'shallowequal'
import {mapGetEnsureValue, mapEqual} from '../util/map'

type EngineActions =
  | EngineGen.Chat1NotifyChatChatTypingUpdatePayload
  | EngineGen.Chat1NotifyChatChatParticipantsInfoPayload
  | EngineGen.Chat1ChatUiChatBotCommandsUpdateStatusPayload
  | EngineGen.Chat1ChatUiChatInboxLayoutPayload
  | EngineGen.Chat1NotifyChatChatAttachmentDownloadCompletePayload
  | EngineGen.Chat1NotifyChatChatAttachmentDownloadProgressPayload

type Actions =
  | Chat2Gen.Actions
  | TeamBuildingGen.Actions
  | EngineActions
  | BotsGen.UpdateFeaturedBotsPayload
  | BotsGen.SetLoadedAllBotsPayload
  | BotsGen.SetSearchFeaturedAndUsersResultsPayload

const initialState: Types.State = Constants.makeState()

// Backend gives us messageIDs sometimes so we need to find our ordinal
const messageIDToOrdinal = (
  messageMap: Container.Draft<Types.State['messageMap']>,
  pendingOutboxToOrdinal: Container.Draft<Types.State['pendingOutboxToOrdinal']>,
  conversationIDKey: Types.ConversationIDKey,
  messageID: Types.MessageID
) => {
  // A message we didn't send in this session?
  const map = messageMap.get(conversationIDKey)
  let m = map?.get(Types.numberToOrdinal(messageID))
  if (m?.id !== 0 && m?.id === messageID) {
    return m.ordinal
  }
  // Search through our sent messages
  const pendingOrdinal = [
    ...(pendingOutboxToOrdinal.get(conversationIDKey) ?? new Map<Types.OutboxID, Types.Ordinal>()).values(),
  ].find(o => {
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

const botActions: Container.ActionHandler<Actions, Types.State> = {
  [BotsGen.updateFeaturedBots]: (draftState, action) => {
    const {bots, page} = action.payload
    bots.map(b => draftState.featuredBotsMap.set(b.botUsername, b))
    if (page !== undefined) {
      draftState.featuredBotsPage = page
    }
  },
  [BotsGen.setLoadedAllBots]: (draftState, action) => {
    const {loaded} = action.payload
    draftState.featuredBotsLoaded = loaded
  },
  [BotsGen.setSearchFeaturedAndUsersResults]: (draftState, action) => {
    draftState.botSearchResults.set(action.payload.query, action.payload.results)
  },
}

const stopAudioRecording = (
  draftState: Container.Draft<Types.State>,
  action: Chat2Gen.StopAudioRecordingPayload
) => {
  const {conversationIDKey, stopType, amps} = action.payload
  const info = draftState.audioRecording.get(conversationIDKey)
  if (info) {
    let nextStatus: Types.AudioRecordingStatus = info.status
    if (nextStatus === Types.AudioRecordingStatus.CANCELLED) {
      return
    }
    let nextPath = info.path
    if (info.isLocked) {
      switch (stopType) {
        case Types.AudioStopType.CANCEL:
          nextStatus = Types.AudioRecordingStatus.CANCELLED
          nextPath = ''
          break
        case Types.AudioStopType.SEND:
          nextStatus = Types.AudioRecordingStatus.STOPPED
          break
        case Types.AudioStopType.STOPBUTTON:
          nextStatus = Types.AudioRecordingStatus.STAGED
          break
      }
    } else {
      switch (stopType) {
        case Types.AudioStopType.CANCEL:
          nextStatus = Types.AudioRecordingStatus.CANCELLED
          nextPath = ''
          break
        default:
          nextStatus = Types.AudioRecordingStatus.STOPPED
      }
    }
    info.amps = amps
    info.path = nextPath
    info.recordEnd = Constants.isStoppedAudioRecordingStatus(nextStatus) ? Date.now() : undefined
    info.status = nextStatus
  }
}

const audioActions: Container.ActionHandler<Actions, Types.State> = {
  [Chat2Gen.enableAudioRecording]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    draftState.audioRecording.set(conversationIDKey, Constants.makeAudioRecordingInfo())
  },
  [Chat2Gen.stopAudioRecording]: stopAudioRecording,
  [Chat2Gen.lockAudioRecording]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {audioRecording} = draftState
    const info = mapGetEnsureValue(audioRecording, conversationIDKey, Constants.makeAudioRecordingInfo())
    info.isLocked = true
  },
  [Chat2Gen.sendAudioRecording]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {audioRecording} = draftState
    audioRecording.delete(conversationIDKey)
  },
  [Chat2Gen.setAudioRecordingPostInfo]: (draftState, action) => {
    const {conversationIDKey, outboxID, path} = action.payload
    const {audioRecording} = draftState
    const info = audioRecording.get(conversationIDKey)
    if (info) {
      if (info.status !== Types.AudioRecordingStatus.INITIAL) {
        return
      }
      audioRecording.set(conversationIDKey, info)
      info.outboxID = outboxID
      info.path = path
      info.status = Types.AudioRecordingStatus.RECORDING
    }
  },
}

const giphyActions: Container.ActionHandler<Actions, Types.State> = {
  [Chat2Gen.giphyToggleWindow]: (draftState, action) => {
    const {conversationIDKey, show, clearInput} = action.payload
    const {giphyWindowMap, giphyResultMap, unsentTextMap} = draftState
    giphyWindowMap.set(conversationIDKey, show)
    !show && giphyResultMap.set(conversationIDKey, undefined)
    clearInput && unsentTextMap.set(conversationIDKey, new HiddenString(''))
  },
  [Chat2Gen.giphySend]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {giphyWindowMap, unsentTextMap} = draftState
    giphyWindowMap.set(conversationIDKey, false)
    unsentTextMap.set(conversationIDKey, new HiddenString(''))
  },
  [Chat2Gen.toggleGiphyPrefill]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {giphyWindowMap, unsentTextMap} = draftState
    // if the window is up, just blow it away
    unsentTextMap.set(
      conversationIDKey,
      new HiddenString(giphyWindowMap.get(conversationIDKey) ? '' : '/giphy ')
    )
  },
  [Chat2Gen.giphyGotSearchResult]: (draftState, action) => {
    const {conversationIDKey, results} = action.payload
    const {giphyResultMap} = draftState
    giphyResultMap.set(conversationIDKey, results)
  },
}

const paymentActions: Container.ActionHandler<Actions, Types.State> = {
  [Chat2Gen.setPaymentConfirmInfo]: (draftState, action) => {
    const {error, summary} = action.payload
    draftState.paymentConfirmInfo = error ? {error} : {summary}
  },
  [Chat2Gen.clearPaymentConfirmInfo]: draftState => {
    draftState.paymentConfirmInfo = undefined
  },
  [Chat2Gen.paymentInfoReceived]: (draftState, action) => {
    const {conversationIDKey, messageID, paymentInfo} = action.payload
    const {accountsInfoMap, paymentStatusMap} = draftState
    const convMap = mapGetEnsureValue(accountsInfoMap, conversationIDKey, new Map())
    convMap.set(messageID, paymentInfo)
    paymentStatusMap.set(paymentInfo.paymentID, paymentInfo)
  },
}

const searchActions: Container.ActionHandler<Actions, Types.State> = {
  [Chat2Gen.threadSearchResults]: (draftState, action) => {
    const {conversationIDKey, clear, messages} = action.payload
    const {threadSearchInfoMap} = draftState
    const info = mapGetEnsureValue(threadSearchInfoMap, conversationIDKey, Constants.makeThreadSearchInfo())
    info.hits = clear ? messages : [...info.hits, ...messages]
  },
  [Chat2Gen.setThreadSearchStatus]: (draftState, action) => {
    const {conversationIDKey, status} = action.payload
    const {threadSearchInfoMap} = draftState
    const info = mapGetEnsureValue(threadSearchInfoMap, conversationIDKey, Constants.makeThreadSearchInfo())
    info.status = status
  },
  [Chat2Gen.toggleThreadSearch]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {threadSearchInfoMap, messageCenterOrdinals} = draftState
    const info = mapGetEnsureValue(threadSearchInfoMap, conversationIDKey, Constants.makeThreadSearchInfo())
    info.hits = []
    info.status = 'initial'
    info.visible = !info.visible

    messageCenterOrdinals.delete(conversationIDKey)
  },
  [Chat2Gen.threadSearch]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {threadSearchInfoMap} = draftState
    const info = mapGetEnsureValue(threadSearchInfoMap, conversationIDKey, Constants.makeThreadSearchInfo())
    info.hits = []
  },
  [Chat2Gen.setThreadSearchQuery]: (draftState, action) => {
    const {conversationIDKey, query} = action.payload
    const {threadSearchQueryMap} = draftState
    threadSearchQueryMap.set(conversationIDKey, query)
  },
  [Chat2Gen.inboxSearchOpenTeamsResults]: (draftState, action) => {
    const {inboxSearch} = draftState
    if (inboxSearch?.openTeamsStatus === 'inprogress') {
      const {results, suggested} = action.payload
      inboxSearch.openTeamsResultsSuggested = suggested
      inboxSearch.openTeamsResults = results
      inboxSearch.openTeamsStatus = 'success'
    }
  },
  [Chat2Gen.inboxSearchBotsResults]: (draftState, action) => {
    const {inboxSearch} = draftState
    if (inboxSearch?.botsStatus === 'inprogress') {
      const {results, suggested} = action.payload
      inboxSearch.botsResultsSuggested = suggested
      inboxSearch.botsResults = results
      inboxSearch.botsStatus = 'success'
    }
  },
  [Chat2Gen.inboxSearchSetTextStatus]: (draftState, action) => {
    const {status} = action.payload
    const inboxSearch = draftState.inboxSearch ?? Constants.makeInboxSearchInfo()
    draftState.inboxSearch = inboxSearch
    inboxSearch.textStatus = status
  },
  [Chat2Gen.inboxSearchSetIndexPercent]: (draftState, action) => {
    const {percent} = action.payload
    const {inboxSearch} = draftState
    if (inboxSearch?.textStatus === 'inprogress') {
      inboxSearch.indexPercent = percent
    }
  },
  [Chat2Gen.toggleInboxSearch]: (draftState, action) => {
    const {enabled} = action.payload
    const {inboxSearch} = draftState
    if (enabled && !inboxSearch) {
      draftState.inboxSearch = Constants.makeInboxSearchInfo()
    } else if (!enabled && inboxSearch) {
      draftState.inboxSearch = undefined
    }
  },
  [Chat2Gen.inboxSearchTextResult]: (draftState, action) => {
    const {inboxSearch} = draftState
    if (inboxSearch && inboxSearch.textStatus === 'inprogress') {
      const {result} = action.payload
      const {conversationIDKey} = result
      const textResults = inboxSearch.textResults.filter(r => r.conversationIDKey !== conversationIDKey)
      textResults.push(result)
      inboxSearch.textResults = textResults.sort((l, r) => r.time - l.time)
    }
  },
  [Chat2Gen.inboxSearchStarted]: draftState => {
    const {inboxSearch} = draftState
    if (inboxSearch) {
      inboxSearch.nameStatus = 'inprogress'
      inboxSearch.selectedIndex = 0
      inboxSearch.textResults = []
      inboxSearch.textStatus = 'inprogress'
      inboxSearch.openTeamsStatus = 'inprogress'
      inboxSearch.botsStatus = 'inprogress'
    }
  },
  [Chat2Gen.inboxSearchNameResults]: (draftState, action) => {
    const {inboxSearch} = draftState
    if (inboxSearch?.nameStatus === 'inprogress') {
      const {results, unread} = action.payload
      inboxSearch.nameResults = results
      inboxSearch.nameResultsUnread = unread
      inboxSearch.nameStatus = 'success'
    }
  },
  [Chat2Gen.inboxSearchMoveSelectedIndex]: (draftState, action) => {
    const {inboxSearch} = draftState
    if (inboxSearch) {
      const {increment} = action.payload
      const {selectedIndex} = inboxSearch
      const totalResults = inboxSearch.nameResults.length + inboxSearch.textResults.length
      if (increment && selectedIndex < totalResults - 1) {
        inboxSearch.selectedIndex = selectedIndex + 1
      } else if (!increment && selectedIndex > 0) {
        inboxSearch.selectedIndex = selectedIndex - 1
      }
    }
  },
  [Chat2Gen.inboxSearchSelect]: (draftState, action) => {
    const {selectedIndex} = action.payload
    const {inboxSearch} = draftState
    if (inboxSearch && selectedIndex != null) {
      inboxSearch.selectedIndex = selectedIndex
    }
  },
  [Chat2Gen.inboxSearch]: (draftState, action) => {
    const {query} = action.payload
    const {inboxSearch} = draftState
    if (inboxSearch) {
      inboxSearch.query = query
    }
  },
}

const attachmentActions: Container.ActionHandler<Actions, Types.State> = {
  [Chat2Gen.loadAttachmentView]: (draftState, action) => {
    const {conversationIDKey, viewType} = action.payload
    const {attachmentViewMap} = draftState
    const viewMap = mapGetEnsureValue(attachmentViewMap, conversationIDKey, new Map())
    const info = mapGetEnsureValue(viewMap, viewType, Constants.makeAttachmentViewInfo())
    info.status = 'loading'
  },
  [Chat2Gen.addAttachmentViewMessage]: (draftState, action) => {
    const {conversationIDKey, viewType, message} = action.payload
    const {attachmentViewMap} = draftState
    const viewMap = mapGetEnsureValue(attachmentViewMap, conversationIDKey, new Map())
    const info = mapGetEnsureValue(viewMap, viewType, Constants.makeAttachmentViewInfo())
    viewMap.set(viewType, info)

    if (info.messages.findIndex((item: any) => item.id === action.payload.message.id) < 0) {
      info.messages = info.messages.concat(message).sort((l: any, r: any) => r.id - l.id)
    }
  },
  [Chat2Gen.setAttachmentViewStatus]: (draftState, action) => {
    const {conversationIDKey, viewType, last, status} = action.payload
    const {attachmentViewMap} = draftState
    const viewMap = mapGetEnsureValue(attachmentViewMap, conversationIDKey, new Map())
    const info = mapGetEnsureValue(viewMap, viewType, Constants.makeAttachmentViewInfo())
    info.last = !!last
    info.status = status
  },
  [Chat2Gen.clearAttachmentView]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {attachmentViewMap} = draftState
    attachmentViewMap.delete(conversationIDKey)
  },
  [Chat2Gen.attachmentUploading]: (draftState, action) => {
    const {conversationIDKey, outboxID, ratio} = action.payload
    const {pendingOutboxToOrdinal, messageMap} = draftState
    const convMap = pendingOutboxToOrdinal.get(conversationIDKey)
    const ordinal = convMap && convMap.get(outboxID)
    if (ordinal) {
      const map = messageMap.get(conversationIDKey)
      const m = map?.get(ordinal)
      if (m?.type === 'attachment') {
        m.transferProgress = ratio
        m.transferState = 'uploading'
      }
    }
  },
  [Chat2Gen.attachmentUploaded]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState
    const map = messageMap.get(conversationIDKey)
    const m = map?.get(ordinal)
    if (m?.type === 'attachment') {
      m.transferProgress = 0
      m.transferState = null
    }
  },
  [Chat2Gen.attachmentMobileSave]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState

    const map = messageMap.get(conversationIDKey)
    const m = map?.get(ordinal)
    if (m?.type === 'attachment') {
      m.transferState = 'mobileSaving'
      m.transferErrMsg = null
    }
  },
  [Chat2Gen.attachmentMobileSaved]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState
    const map = messageMap.get(conversationIDKey)
    const m = map?.get(ordinal)
    if (m?.type === 'attachment') {
      m.transferState = null
      m.transferErrMsg = null
    }
  },
  [Chat2Gen.attachmentDownload]: (draftState, action) => {
    const {message} = action.payload
    const {messageMap} = draftState
    const map = messageMap.get(message.conversationIDKey)
    const m = map?.get(message.ordinal)
    if (m?.type === 'attachment') {
      m.transferState = 'downloading'
      m.transferErrMsg = null
    }
  },
  [Chat2Gen.messageAttachmentUploaded]: (draftState, action) => {
    const {conversationIDKey, message, placeholderID} = action.payload
    const {messageMap} = draftState
    const ordinal = messageIDToOrdinal(
      draftState.messageMap,
      draftState.pendingOutboxToOrdinal,
      conversationIDKey,
      placeholderID
    )
    if (ordinal) {
      const map = mapGetEnsureValue(messageMap, conversationIDKey, new Map())
      const m = map.get(ordinal)
      map.set(ordinal, m ? Constants.upgradeMessage(m, message) : message)
    }
  },
  [EngineGen.chat1NotifyChatChatAttachmentDownloadComplete]: (draftState, action) => {
    const {convID, msgID} = action.payload.params
    const conversationIDKey = Types.conversationIDToKey(convID)
    const ordinal = messageIDToOrdinal(
      draftState.messageMap,
      draftState.pendingOutboxToOrdinal,
      conversationIDKey,
      msgID
    )
    if (!ordinal) {
      logger.info(
        `downloadComplete: no ordinal found: conversationIDKey: ${conversationIDKey} msgID: ${msgID}`
      )
      return
    }
    const message = draftState.messageMap.get(conversationIDKey)?.get(ordinal)
    if (!message) {
      logger.info(
        `downloadComplete: no message found: conversationIDKey: ${conversationIDKey} ordinal: ${ordinal}`
      )
      return
    }
    if (message?.type === 'attachment') {
      message.transferState = null
      message.transferProgress = 0
    }
  },
  [EngineGen.chat1NotifyChatChatAttachmentDownloadProgress]: (draftState, action) => {
    const {convID, msgID, bytesComplete, bytesTotal} = action.payload.params
    const conversationIDKey = Types.conversationIDToKey(convID)
    const ordinal = messageIDToOrdinal(
      draftState.messageMap,
      draftState.pendingOutboxToOrdinal,
      conversationIDKey,
      msgID
    )
    if (!ordinal) {
      logger.info(
        `downloadProgress: no ordinal found: conversationIDKey: ${conversationIDKey} msgID: ${msgID}`
      )
      return
    }
    const message = draftState.messageMap.get(conversationIDKey)?.get(ordinal)
    if (!message) {
      logger.info(
        `downloadProgress: no message found: conversationIDKey: ${conversationIDKey} ordinal: ${ordinal}`
      )
      return
    }
    const {attachmentViewMap, messageMap} = draftState
    const ratio = bytesComplete / bytesTotal
    const viewType = RPCChatTypes.GalleryItemTyp.doc
    const viewMap = mapGetEnsureValue(attachmentViewMap, conversationIDKey, new Map())
    const info = mapGetEnsureValue(viewMap, viewType, Constants.makeAttachmentViewInfo())
    const {messages} = info
    const idx = messages.findIndex(item => item.id === message.id)
    if (idx !== -1) {
      const m = messages[idx]
      if (m.type === 'attachment') {
        m.transferState = 'downloading'
        m.transferProgress = ratio
      }
    }

    const map = messageMap.get(conversationIDKey)
    const m = map?.get(message.ordinal)
    if (m?.type === 'attachment') {
      m.transferProgress = ratio
      m.transferState = 'downloading'
      m.transferErrMsg = null
    }
  },
  [Chat2Gen.attachmentDownloaded]: (draftState, action) => {
    const {message, path, error} = action.payload
    const {conversationIDKey, ordinal} = message
    const {messageMap} = draftState
    const {attachmentViewMap} = draftState
    const viewMap = mapGetEnsureValue(attachmentViewMap, conversationIDKey, new Map())
    const viewType = RPCChatTypes.GalleryItemTyp.doc
    const info = mapGetEnsureValue(viewMap, viewType, Constants.makeAttachmentViewInfo())

    const {messages} = info
    const idx = messages.findIndex(item => item.id === message.id)
    if (idx !== -1) {
      const m = messages[idx]
      if (m.type === 'attachment') {
        m.downloadPath = path ?? null
        m.fileURLCached = true
        m.transferProgress = 0
        m.transferState = null
      }
    }

    const map = messageMap.get(conversationIDKey)
    const m = map?.get(ordinal)
    if (m?.type === 'attachment') {
      m.downloadPath = (!error && path) || ''
      m.transferProgress = 0
      m.transferState = null
      m.transferErrMsg = error ? error ?? 'Error downloading attachment' : null
      m.fileURLCached = true // assume we have this on the service now
    }
  },
}

const reducer = Container.makeReducer<Actions, Types.State>(initialState, {
  [Chat2Gen.resetStore]: draftState => {
    return {...initialState, staticConfig: draftState.staticConfig as Types.State['staticConfig']}
  },
  [Chat2Gen.toggleSmallTeamsExpanded]: draftState => {
    draftState.smallTeamsExpanded = !draftState.smallTeamsExpanded
  },
  [Chat2Gen.changeFocus]: (draftState, action) => {
    draftState.focus = action.payload.nextFocus
  },
  [Chat2Gen.selectedConversation]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {threadLoadStatus, containsLatestMessageMap, orangeLineMap} = draftState
    const {metaMap, messageCenterOrdinals} = draftState

    if (conversationIDKey) {
      const {readMsgID, maxVisibleMsgID} = metaMap.get(conversationIDKey) ?? Constants.makeConversationMeta()

      logger.info(
        `rootReducer: selectConversation: setting orange line: convID: ${conversationIDKey} maxVisible: ${maxVisibleMsgID} read: ${readMsgID}`
      )
      if (maxVisibleMsgID > readMsgID) {
        // Store the message ID that will display the orange line above it,
        // which is the first message after the last read message. We can't
        // just increment `readMsgID` since that msgID might be a
        // non-visible (edit, delete, reaction...) message so we scan the
        // ordinals for the appropriate value.
        const messageMap = draftState.messageMap.get(conversationIDKey)
        const ordinals = [...(draftState.messageOrdinals.get(conversationIDKey) || [])]
        const ord =
          messageMap &&
          ordinals.find(o => {
            const message = messageMap.get(o)
            return !!(message && message.id >= readMsgID + 1)
          })
        const message = ord ? messageMap?.get(ord) : null
        if (message?.id) {
          orangeLineMap.set(conversationIDKey, message.id)
        } else {
          orangeLineMap.delete(conversationIDKey)
        }
      } else {
        // If there aren't any new messages, we don't want to display an
        // orange line so remove its entry from orangeLineMap
        orangeLineMap.delete(conversationIDKey)
      }
    }
    // blank out draft so we don't flash old data when switching convs
    const meta = metaMap.get(conversationIDKey)
    if (meta) {
      meta.draft = ''
    }
    messageCenterOrdinals.delete(conversationIDKey)
    threadLoadStatus.delete(conversationIDKey)
    containsLatestMessageMap.set(conversationIDKey, true)
    if (Constants.isValidConversationIDKey(conversationIDKey)) {
      // If navigating away from error conversation to a valid conv - clear
      // error msg.
      draftState.createConversationError = null
    }
  },
  [Chat2Gen.conversationErrored]: (draftState, action) => {
    const {allowedUsers, code, disallowedUsers, message} = action.payload
    draftState.createConversationError = {
      allowedUsers,
      code,
      disallowedUsers,
      message,
    }
  },
  [Chat2Gen.updateUnreadline]: (draftState, action) => {
    const {conversationIDKey, messageID} = action.payload
    const {orangeLineMap} = draftState
    if (messageID > 0) {
      orangeLineMap.set(conversationIDKey, messageID)
    } else {
      orangeLineMap.delete(action.payload.conversationIDKey)
    }
  },
  [Chat2Gen.unfurlTogglePrompt]: (draftState, action) => {
    const {show, domain, conversationIDKey, messageID} = action.payload
    const {unfurlPromptMap} = draftState
    const map = mapGetEnsureValue(unfurlPromptMap, conversationIDKey, new Map())
    const prompts = mapGetEnsureValue(map, messageID, new Set())

    if (show) {
      prompts.add(domain)
    } else {
      prompts.delete(domain)
    }
  },
  [Chat2Gen.updateCoinFlipStatus]: (draftState, action) => {
    const {statuses} = action.payload
    const {flipStatusMap} = draftState
    statuses.forEach(status => {
      flipStatusMap.set(status.gameID, status)
    })
  },
  [Chat2Gen.messageSend]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {commandMarkdownMap, replyToMap} = draftState
    commandMarkdownMap.delete(conversationIDKey)
    replyToMap.delete(conversationIDKey)
  },
  [Chat2Gen.setCommandMarkdown]: (draftState, action) => {
    const {conversationIDKey, md} = action.payload
    const {commandMarkdownMap} = draftState
    if (md) {
      commandMarkdownMap.set(conversationIDKey, md)
    } else {
      commandMarkdownMap.delete(conversationIDKey)
    }
  },
  [Chat2Gen.setThreadLoadStatus]: (draftState, action) => {
    const {conversationIDKey, status} = action.payload
    const {threadLoadStatus} = draftState
    threadLoadStatus.set(conversationIDKey, status)
  },
  [Chat2Gen.setCommandStatusInfo]: (draftState, action) => {
    const {conversationIDKey, info} = action.payload
    const {commandStatusMap} = draftState
    commandStatusMap.set(conversationIDKey, info)
  },
  [Chat2Gen.clearCommandStatusInfo]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {commandStatusMap} = draftState
    commandStatusMap.delete(conversationIDKey)
  },
  [Chat2Gen.updateLastCoord]: (draftState, action) => {
    draftState.lastCoord = action.payload.coord
  },
  [Chat2Gen.badgesUpdated]: (draftState, action) => {
    const {bigTeamBadgeCount, conversations, smallTeamBadgeCount} = action.payload
    const badgeMap = new Map<Types.ConversationIDKey, number>()
    const unreadMap = new Map<Types.ConversationIDKey, number>()
    conversations.forEach(({convID, badgeCount, unreadMessages}) => {
      const key = Types.conversationIDToKey(convID)
      badgeMap.set(key, badgeCount)
      unreadMap.set(key, unreadMessages)
    })

    draftState.smallTeamBadgeCount = smallTeamBadgeCount
    draftState.bigTeamBadgeCount = bigTeamBadgeCount
    if (!mapEqual(draftState.badgeMap, badgeMap)) {
      draftState.badgeMap = badgeMap
    }
    if (!mapEqual(draftState.unreadMap, unreadMap)) {
      draftState.unreadMap = unreadMap
    }
  },
  [Chat2Gen.messageSetEditing]: (draftState, action) => {
    const {conversationIDKey, editLastUser, ordinal} = action.payload
    const {editingMap, messageOrdinals} = draftState

    // clearing
    if (!editLastUser && !ordinal) {
      editingMap.delete(conversationIDKey)
      return
    }

    const messageMap = draftState.messageMap.get(conversationIDKey)

    // editing a specific message
    if (ordinal) {
      const message = messageMap?.get(ordinal)
      if (message?.type === 'text' || message?.type === 'attachment') {
        editingMap.set(conversationIDKey, ordinal)
      }
      return
    }

    // Editing your last message
    const ordinals = [...(messageOrdinals.get(conversationIDKey) || [])]
    const found = ordinals.reverse().find(o => {
      const message = messageMap?.get(o)
      return !!(
        (message?.type === 'text' || message?.type === 'attachment') &&
        message.author === editLastUser &&
        !message.exploded &&
        message.isEditable
      )
    })
    if (found) {
      editingMap.set(conversationIDKey, found)
    }
  },
  [Chat2Gen.messageSetQuoting]: (draftState, action) => {
    const {ordinal, sourceConversationIDKey, targetConversationIDKey} = action.payload
    const counter = (draftState.quote ? draftState.quote.counter : 0) + 1
    draftState.quote = {
      counter,
      ordinal,
      sourceConversationIDKey,
      targetConversationIDKey,
    }
  },
  [Chat2Gen.addToMessageMap]: (draftState, action) => {
    const {message} = action.payload
    const convMap =
      draftState.messageMap.get(message.conversationIDKey) ?? new Map<Types.Ordinal, Types.Message>()
    convMap.set(message.ordinal, message)
    draftState.messageMap.set(message.conversationIDKey, convMap)
  },
  [Chat2Gen.messagesAdd]: (draftState, action) => {
    const {context, conversationIDKey, shouldClearOthers} = action.payload
    // pull out deletes and handle at the end
    const [messages, deletedMessages] = partition<Types.Message>(
      action.payload.messages,
      m => m.type !== 'deleted'
    )
    logger.info(
      `messagesAdd: running in context: ${context.type} messages: ${messages.length} deleted: ${deletedMessages.length}`
    )
    // we want the clear applied when we call findExisting
    const messageOrdinals = new Map(draftState.messageOrdinals)
    const oldPendingOutboxToOrdinal = new Map(draftState.pendingOutboxToOrdinal)
    const oldMessageMap = new Map(draftState.messageMap)

    // so we can keep messages if they haven't mutated
    const previousMessageMap = new Map(draftState.messageMap)

    if (shouldClearOthers) {
      logger.info(`messagesAdd: clearing existing data`)
      messageOrdinals.delete(conversationIDKey)
      oldPendingOutboxToOrdinal.delete(conversationIDKey)
      oldMessageMap.delete(conversationIDKey)
      draftState.hasZzzJourneycard.delete(conversationIDKey)
    }

    // Update any pending messages
    const pendingOutboxToOrdinal = new Map(oldPendingOutboxToOrdinal)
    messages.forEach(message => {
      if (message.submitState === 'pending' && message.outboxID) {
        const outToOrd = new Map(pendingOutboxToOrdinal.get(conversationIDKey) || [])
        logger.info(
          `messagesAdd: setting new outbox ordinal: ${message.ordinal} outboxID: ${message.outboxID}`
        )
        outToOrd.set(message.outboxID, message.ordinal)
        pendingOutboxToOrdinal.set(conversationIDKey, outToOrd)
      }
    })

    const findExistingSentOrPending = (conversationIDKey: Types.ConversationIDKey, m: Types.Message) => {
      // something we sent
      if (m.outboxID) {
        // and we know about it
        const outMap = oldPendingOutboxToOrdinal.get(conversationIDKey)
        const ordinal = outMap && outMap.get(m.outboxID)
        if (ordinal) {
          const map = oldMessageMap.get(conversationIDKey)
          return map?.get(ordinal)
        }
      }
      const pendingOrdinal = messageIDToOrdinal(
        oldMessageMap,
        oldPendingOutboxToOrdinal,
        conversationIDKey,
        m.id
      )
      if (pendingOrdinal) {
        const map = oldMessageMap.get(conversationIDKey)
        return map?.get(pendingOrdinal)
      }
      return null
    }

    // remove all deleted messages from ordinals that we are passed as a parameter
    let os = messageOrdinals.get(conversationIDKey) || new Set()
    deletedMessages.forEach(m => os.delete(m.ordinal))
    messageOrdinals.set(conversationIDKey, os)

    const removedOrdinals: Array<Types.Ordinal> = []
    const ordinals = messages.reduce<Array<Types.Ordinal>>((arr, message) => {
      if (message.type === 'placeholder') {
        // sometimes we send then get a placeholder for that send. Lets see if we already have the message id for the sent
        // and ignore the placeholder in that instance
        logger.info(`messagesAdd: got placeholder message with id: ${message.id}`)
        const existingOrdinal = messageIDToOrdinal(
          oldMessageMap,
          pendingOutboxToOrdinal,
          conversationIDKey,
          message.id
        )
        if (!existingOrdinal) {
          arr.push(message.ordinal)
        } else {
          logger.info(
            `messagesAdd: skipping placeholder for message with id ${message.id} because already exists`
          )
        }
      } else {
        // Sendable so we might have an existing message
        const existing = findExistingSentOrPending(conversationIDKey, message)
        if (!existing || !messageOrdinals.get(conversationIDKey)?.has(existing.ordinal)) {
          arr.push(message.ordinal)
        } else {
          logger.info(
            `messagesAdd: skipping existing message for ordinal add: ordinal: ${message.ordinal} outboxID: ${message.outboxID}`
          )
        }
        // We might have a placeholder for this message in there with ordinal of its own ID, let's
        // get rid of it if that is the case
        const lookupID = message.id || existing?.id
        if (lookupID) {
          const map = oldMessageMap.get(conversationIDKey)
          const oldMsg = map?.get(Types.numberToOrdinal(lookupID))
          if (
            oldMsg?.type === 'placeholder' &&
            // don't delete the placeholder if we're just about to replace it ourselves
            oldMsg.ordinal !== message.ordinal
          ) {
            logger.info(`messagesAdd: removing old placeholder: ${oldMsg.ordinal}`)
            removedOrdinals.push(oldMsg.ordinal)
          }
        }
      }
      return arr
    }, [])

    // add new ones, remove deleted ones, sort. This pass is for when we remove placeholder messages
    // with their resolved ids
    os = new Set(messageOrdinals.get(conversationIDKey) || [])
    removedOrdinals.forEach(o => os.delete(o))
    messageOrdinals.set(conversationIDKey, new Set([...os, ...ordinals].sort((a, b) => a - b)))

    // clear out message map of deleted stuff
    const messageMap = new Map(oldMessageMap)
    const map = messageMap.get(conversationIDKey)
    if (map) {
      deletedMessages.forEach(m => map.delete(m.ordinal))
      removedOrdinals.forEach(o => map.delete(o))
    }

    // update messages
    messages.forEach(message => {
      const oldSentOrPending = findExistingSentOrPending(conversationIDKey, message)
      let toSet: Types.Message | undefined
      if (oldSentOrPending) {
        toSet = Constants.upgradeMessage(oldSentOrPending, message)
        logger.info(`messagesAdd: upgrade message: ordinal: ${message.ordinal} id: ${message.id}`)
      } else {
        const map = previousMessageMap.get(conversationIDKey)
        toSet = Constants.mergeMessage((map && map.get(message.ordinal)) || null, message)
      }
      const map = messageMap.get(conversationIDKey) || new Map<Types.Ordinal, Types.Message>()
      messageMap.set(conversationIDKey, map)
      map.set(toSet.ordinal, toSet)
    })

    const containsLatestMessageMap = new Map(draftState.containsLatestMessageMap)
    if (!action.payload.forceContainsLatestCalc && containsLatestMessageMap.get(conversationIDKey)) {
      // do nothing
    } else {
      const meta = draftState.metaMap.get(conversationIDKey)
      const ordinals = [...(messageOrdinals.get(conversationIDKey) || [])]
      let maxMsgID = 0
      const convMsgMap = messageMap.get(conversationIDKey) || new Map<Types.Ordinal, Types.Message>()
      messageMap.set(conversationIDKey, convMsgMap)
      for (let i = ordinals.length - 1; i >= 0; i--) {
        const ordinal = ordinals[i]
        const message = convMsgMap.get(ordinal)
        if (message && message.id > 0) {
          maxMsgID = message.id
          break
        }
      }
      if (meta && maxMsgID >= meta.maxVisibleMsgID) {
        containsLatestMessageMap.set(conversationIDKey, true)
      } else if (action.payload.forceContainsLatestCalc) {
        containsLatestMessageMap.set(conversationIDKey, false)
      }
    }
    draftState.containsLatestMessageMap = containsLatestMessageMap

    let messageCenterOrdinals = new Map(draftState.messageCenterOrdinals)
    const centeredMessageIDs = action.payload.centeredMessageIDs || []
    centeredMessageIDs.forEach(cm => {
      let ordinal = messageIDToOrdinal(
        draftState.messageMap,
        draftState.pendingOutboxToOrdinal,
        cm.conversationIDKey,
        cm.messageID
      )
      if (!ordinal) {
        ordinal = Types.numberToOrdinal(Types.messageIDToNumber(cm.messageID))
      }
      messageCenterOrdinals.set(cm.conversationIDKey, {
        highlightMode: cm.highlightMode,
        ordinal,
      })
    })

    // Identify convs that have a zzz CHANNEL_INACTIVE journeycard.
    // Convs that used to have a zzz journeycard and just got a newer message should delete the journeycard.
    const jc = messages.find(
      m => m.type == 'journeycard' && m.cardType == RPCChatTypes.JourneycardType.channelInactive
    ) as Types.MessageJourneycard | undefined
    if (jc) {
      draftState.hasZzzJourneycard.set(conversationIDKey, jc)
      draftState.shouldDeleteZzzJourneycard.delete(conversationIDKey)
    } else {
      const priorJc = draftState.hasZzzJourneycard.get(conversationIDKey)
      if (priorJc) {
        // Find a message that has a later ordinal and so should cause the zzz to disappear.
        if (messages.some(m => m.ordinal > priorJc.ordinal)) {
          draftState.hasZzzJourneycard.delete(conversationIDKey)
          draftState.shouldDeleteZzzJourneycard.set(conversationIDKey, priorJc)
        }
      }
    }

    draftState.messageMap = messageMap
    if (centeredMessageIDs.length > 0) {
      draftState.messageCenterOrdinals = messageCenterOrdinals
    }
    draftState.containsLatestMessageMap = containsLatestMessageMap
    // only if different
    if (!shallowEqual([...draftState.messageOrdinals], [...messageOrdinals])) {
      draftState.messageOrdinals = messageOrdinals
    }
    draftState.pendingOutboxToOrdinal = pendingOutboxToOrdinal
    draftState.messageMap = messageMap
  },
  [Chat2Gen.jumpToRecent]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {messageCenterOrdinals} = draftState
    messageCenterOrdinals.delete(conversationIDKey)
  },
  [Chat2Gen.setContainsLastMessage]: (draftState, action) => {
    const {conversationIDKey, contains} = action.payload
    const {containsLatestMessageMap} = draftState
    containsLatestMessageMap.set(conversationIDKey, contains)
  },
  [Chat2Gen.messageRetry]: (draftState, action) => {
    const {conversationIDKey, outboxID} = action.payload
    const {pendingOutboxToOrdinal, messageMap} = draftState
    const outToOrd = pendingOutboxToOrdinal.get(conversationIDKey)
    const ordinal = outToOrd && outToOrd.get(outboxID)
    if (!ordinal) {
      return
    }
    const m = messageMap.get(conversationIDKey)?.get(ordinal)
    if (!m) {
      return
    }
    m.errorReason = undefined
    m.submitState = 'pending'
  },
  [Chat2Gen.messageErrored]: (draftState, action) => {
    const {conversationIDKey, errorTyp, outboxID, reason} = action.payload
    const {pendingOutboxToOrdinal, messageMap} = draftState
    const outToOrd = pendingOutboxToOrdinal.get(conversationIDKey)
    const ordinal = outToOrd && outToOrd.get(outboxID)
    if (!ordinal) {
      return
    }
    const m = messageMap.get(conversationIDKey)?.get(ordinal)
    if (!m) {
      return
    }
    m.errorReason = reason
    m.submitState = 'failed'
    m.errorTyp = errorTyp || undefined
  },
  [EngineGen.chat1ChatUiChatInboxLayout]: (draftState, action) => {
    try {
      const {params} = action.payload
      const {inboxHasLoaded, draftMap, mutedMap} = draftState
      const layout: RPCChatTypes.UIInboxLayout = JSON.parse(params.layout)
      draftState.inboxLayout = layout
      draftState.inboxHasLoaded = true
      if (!inboxHasLoaded) {
        const smallTeams = layout.smallTeams || []
        // on first layout, initialize any drafts and muted status
        // After the first layout, any other updates will come in the form of meta updates.
        smallTeams.forEach(t => {
          if (t.isMuted) {
            mutedMap.set(t.convID, true)
          } else {
            mutedMap.delete(t.convID)
          }
          if (t.draft) {
            draftMap.set(t.convID, t.draft)
          } else {
            draftMap.delete(t.convID)
          }
        })
        const bigTeams = layout.bigTeams || []
        bigTeams.forEach(t => {
          if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
            if (t.channel.isMuted) {
              mutedMap.set(t.channel.convID, true)
            } else {
              mutedMap.delete(t.channel.convID)
            }
            if (t.channel.draft) {
              draftMap.set(t.channel.convID, t.channel.draft)
            } else {
              draftMap.delete(t.channel.convID)
            }
          }
        })
      }
    } catch (e) {
      logger.info('failed to JSON parse inbox layout: ' + e)
    }
  },
  [EngineGen.chat1ChatUiChatBotCommandsUpdateStatus]: (draftState, action) => {
    const {convID, status} = action.payload.params
    const {botCommandsUpdateStatusMap, botSettings} = draftState
    const conversationIDKey = Types.stringToConversationIDKey(convID)
    botCommandsUpdateStatusMap.set(conversationIDKey, status.typ)
    if (status.typ === RPCChatTypes.UIBotCommandsUpdateStatusTyp.uptodate) {
      const settingsMap = new Map<string, RPCTypes.TeamBotSettings>()
      Object.keys(status.uptodate.settings).forEach(u => {
        settingsMap.set(u, status.uptodate.settings[u])
      })
      botSettings.set(conversationIDKey, settingsMap)
    }
  },
  [EngineGen.chat1NotifyChatChatTypingUpdate]: (draftState, action) => {
    const {typingUpdates} = action.payload.params
    const typingMap = new Map<string, Set<string>>()
    const updates = typingUpdates || []
    updates.forEach(u => {
      const key = Types.conversationIDToKey(u.convID)
      const set = new Set((u.typers || []).map(t => t.username))
      typingMap.set(key, set)
    })
    draftState.typingMap = typingMap
  },
  [Chat2Gen.toggleLocalReaction]: (draftState, action) => {
    const {conversationIDKey, decorated, emoji, targetOrdinal, username} = action.payload
    const {messageMap} = draftState

    const m = messageMap.get(conversationIDKey)?.get(targetOrdinal)
    if (m && Constants.isMessageWithReactions(m)) {
      const reactions = m.reactions
      const rs = {
        decorated: reactions.get(emoji)?.decorated ?? decorated,
        users: reactions.get(emoji)?.users ?? new Set(),
      }
      reactions.set(emoji, rs)
      const existing = [...rs.users].find(r => r.username === username)
      if (existing) {
        // found an existing reaction. remove it from our list
        rs.users.delete(existing)
      }
      // no existing reaction. add this one to the map
      rs.users.add(Constants.makeReaction({timestamp: Date.now(), username}))
      if (rs.users.size === 0) {
        reactions.delete(emoji)
      }
    }
  },
  [Chat2Gen.updateBlockButtons]: (draftState, action) => {
    if (action.payload.show) {
      draftState.blockButtonsMap.set(action.payload.teamID, {adder: action.payload.adder || ''})
    } else {
      draftState.blockButtonsMap.delete(action.payload.teamID)
    }
  },
  [Chat2Gen.updateReactions]: (draftState, action) => {
    const {conversationIDKey, updates} = action.payload
    const {messageMap} = draftState
    const targetData = updates.map(u => ({
      reactions: u.reactions,
      targetMsgID: u.targetMsgID,
      targetOrdinal: messageIDToOrdinal(
        messageMap,
        draftState.pendingOutboxToOrdinal,
        conversationIDKey,
        u.targetMsgID
      ),
    }))

    const map = messageMap.get(conversationIDKey)
    if (map) {
      targetData.forEach(td => {
        if (!td.targetOrdinal) {
          logger.info(
            `updateReactions: couldn't find target ordinal for targetMsgID=${td.targetMsgID} in convID=${conversationIDKey}`
          )
          return
        }
        const m = map.get(td.targetOrdinal)
        if (m && m.type !== 'deleted' && m.type !== 'placeholder') {
          m.reactions = td.reactions
        }
      })
    }
  },
  [Chat2Gen.messagesWereDeleted]: (draftState, action) => {
    const {deletableMessageTypes = Constants.allMessageTypes, messageIDs = [], ordinals = []} = action.payload
    const {conversationIDKey, upToMessageID = null} = action.payload
    const {messageMap, messageOrdinals} = draftState

    const upToOrdinals: Array<Types.Ordinal> = []
    if (upToMessageID) {
      const ordinalToMessage = messageMap.get(conversationIDKey)
      ordinalToMessage &&
        [...ordinalToMessage.entries()].reduce((arr, [ordinal, m]) => {
          if (m.id < upToMessageID && deletableMessageTypes.has(m.type)) {
            arr.push(ordinal)
          }
          return arr
        }, upToOrdinals)
    }

    const allOrdinals = new Set(
      [
        ...ordinals,
        ...messageIDs.map(messageID =>
          messageIDToOrdinal(messageMap, draftState.pendingOutboxToOrdinal, conversationIDKey, messageID)
        ),
        ...upToOrdinals,
      ].reduce<Array<Types.Ordinal>>((arr, n) => {
        if (n) {
          arr.push(n)
        }
        return arr
      }, [])
    )

    const map = messageMap.get(conversationIDKey) || new Map<Types.Ordinal, Types.Message>()
    messageMap.set(conversationIDKey, map)

    allOrdinals.forEach(ordinal => {
      const m = map.get(ordinal)
      if (m) {
        map.set(
          ordinal,
          Constants.makeMessageDeleted({
            author: m.author,
            conversationIDKey: m.conversationIDKey,
            id: m.id,
            ordinal: m.ordinal,
            timestamp: m.timestamp,
          })
        )
      }
    })

    const os = messageOrdinals.get(conversationIDKey)
    os && allOrdinals.forEach(o => os.delete(o))
    const maps = [draftState.hasZzzJourneycard, draftState.shouldDeleteZzzJourneycard]
    maps.forEach(m => {
      const el = m.get(conversationIDKey)
      if (el && allOrdinals.has(el.ordinal)) {
        m.delete(conversationIDKey)
      }
    })
  },
  [Chat2Gen.updateMoreToLoad]: (draftState, action) => {
    const {conversationIDKey, moreToLoad} = action.payload
    const {moreToLoadMap} = draftState
    moreToLoadMap.set(conversationIDKey, moreToLoad)
  },
  [Chat2Gen.updateConvExplodingModes]: (draftState, action) => {
    const {modes} = action.payload
    draftState.explodingModes = new Map(
      modes.map(mode => [Types.conversationIDKeyToString(mode.conversationIDKey), mode.seconds])
    )
  },
  [Chat2Gen.setExplodingModeLock]: (draftState, action) => {
    const {conversationIDKey, unset} = action.payload
    const {explodingModes, explodingModeLocks} = draftState
    const mode = explodingModes.get(conversationIDKey) ?? 0
    // we already have the new mode in `explodingModes`, if we've already locked it we shouldn't update
    const alreadyLocked = explodingModeLocks.get(conversationIDKey) !== undefined
    if (unset) {
      explodingModeLocks.delete(conversationIDKey)
    } else if (!alreadyLocked) {
      explodingModeLocks.set(conversationIDKey, mode)
    }
  },
  [Chat2Gen.setUnsentText]: (draftState, action) => {
    const {conversationIDKey, text} = action.payload
    const {unsentTextMap} = draftState
    unsentTextMap.set(conversationIDKey, text)
  },
  [Chat2Gen.setPrependText]: (draftState, action) => {
    const {conversationIDKey, text} = action.payload
    const {prependTextMap} = draftState
    prependTextMap.set(conversationIDKey, text)
  },
  [Chat2Gen.toggleReplyToMessage]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {replyToMap, prependTextMap} = draftState
    if (ordinal) {
      replyToMap.set(conversationIDKey, ordinal)
      // we always put something in prepend to trigger the focus regain on the input bar
      prependTextMap.set(conversationIDKey, new HiddenString(''))
    } else {
      replyToMap.delete(conversationIDKey)
    }
  },
  [Chat2Gen.replyJump]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {messageCenterOrdinals} = draftState
    messageCenterOrdinals.delete(conversationIDKey)
  },
  [Chat2Gen.staticConfigLoaded]: (draftState, action) => {
    draftState.staticConfig = action.payload.staticConfig
  },
  [Chat2Gen.loadedMutualTeams]: (draftState, action) => {
    const {conversationIDKey, teamIDs} = action.payload
    const {mutualTeamMap} = draftState
    mutualTeamMap.set(conversationIDKey, teamIDs)
  },
  [Chat2Gen.loadedUserEmoji]: (draftState, action) => {
    const {results} = action.payload
    const newEmojis: Array<RPCChatTypes.Emoji> = []
    results.emojis.emojis?.map(group => {
      group.emojis?.forEach(e => newEmojis.push(e))
    })
    draftState.userEmojisForAutocomplete = newEmojis
    draftState.userEmojis = results.emojis?.emojis ?? []
  },
  [Chat2Gen.setParticipants]: (draftState, action) => {
    action.payload.participants.forEach(part => {
      draftState.participantMap.set(part.conversationIDKey, part.participants)
    })
  },
  [EngineGen.chat1NotifyChatChatParticipantsInfo]: (draftState, action) => {
    const {participants: participantMap} = action.payload.params
    Object.keys(participantMap).forEach(convIDStr => {
      const participants = participantMap[convIDStr]
      const conversationIDKey = Types.stringToConversationIDKey(convIDStr)
      if (participants) {
        draftState.participantMap.set(
          conversationIDKey,
          Constants.uiParticipantsToParticipantInfo(participants)
        )
      }
    })
  },
  [Chat2Gen.metasReceived]: (draftState, action) => {
    const {metas, initialTrustedLoad, removals} = action.payload
    const {draftMap, mutedMap, metaMap} = draftState
    if (initialTrustedLoad) {
      draftState.trustedInboxHasLoaded = true
    }

    metas.forEach((m: Types.ConversationMeta) => {
      if (m.draft) {
        draftMap.set(m.conversationIDKey, m.draft)
      } else {
        draftMap.delete(m.conversationIDKey)
      }
      if (m.isMuted) {
        mutedMap.set(m.conversationIDKey, true)
      } else {
        mutedMap.delete(m.conversationIDKey)
      }
    })

    removals && removals.forEach(m => metaMap.delete(m))
    metas.forEach(m => {
      const old = metaMap.get(m.conversationIDKey)
      metaMap.set(m.conversationIDKey, old ? Constants.updateMeta(old, m) : m)
    })
  },
  [Chat2Gen.setMaybeMentionInfo]: (draftState, action) => {
    const {name, info} = action.payload
    const {maybeMentionMap} = draftState
    maybeMentionMap.set(name, info)
  },
  [Chat2Gen.requestInfoReceived]: (draftState, action) => {
    const {conversationIDKey, messageID, requestInfo} = action.payload
    const {accountsInfoMap} = draftState
    const convMap = accountsInfoMap.get(conversationIDKey) || new Map()
    accountsInfoMap.set(conversationIDKey, convMap)
    convMap.set(messageID, requestInfo)
  },
  [Chat2Gen.updateUserReacjis]: (draftState, action) => {
    const {skinTone, topReacjis} = action.payload.userReacjis
    draftState.userReacjis.skinTone = skinTone
    draftState.userReacjis.topReacjis = topReacjis || Constants.defaultTopReacjis
  },
  [Chat2Gen.dismissBottomBanner]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {dismissedInviteBannersMap} = draftState
    dismissedInviteBannersMap.set(conversationIDKey, true)
  },
  [Chat2Gen.messageDelete]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState

    const map = messageMap.get(conversationIDKey)
    const m = map?.get(ordinal)
    if (m?.type === 'text') {
      m.submitState = 'deleting'
    }
  },
  [Chat2Gen.messageEdit]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState

    const m = messageMap.get(conversationIDKey)?.get(ordinal)
    if (m?.type === 'text' || m?.type === 'attachment') {
      m.submitState = 'editing'
    }
  },
  [Chat2Gen.messageWasEdited]: (draftState, action) => {
    const {conversationIDKey, messageID, text} = action.payload
    const {mentionsAt, mentionsChannel, mentionsChannelName} = action.payload
    const {messageMap} = draftState

    const ordinal = messageIDToOrdinal(
      messageMap,
      draftState.pendingOutboxToOrdinal,
      conversationIDKey,
      messageID
    )
    if (ordinal) {
      const m = messageMap.get(conversationIDKey)?.get(ordinal)
      if (m?.type === 'text' || m?.type === 'attachment') {
        if (m.type === 'text') {
          m.text = text
        } else if (m.type === 'attachment') {
          m.title = text.stringValue()
        }
        m.hasBeenEdited = true
        m.submitState = undefined
        m.mentionsAt = mentionsAt
        m.mentionsChannel = mentionsChannel
        m.mentionsChannelName = mentionsChannelName
      }
    }
  },
  [Chat2Gen.pendingMessageWasEdited]: (draftState, action) => {
    const {conversationIDKey, ordinal, text} = action.payload
    const {messageMap} = draftState

    const m = messageMap.get(conversationIDKey)?.get(ordinal)
    if (m?.type === 'text') {
      m.text = text
    } else if (m?.type === 'attachment') {
      m.title = text.stringValue()
    }
  },
  [Chat2Gen.metaReceivedError]: (draftState, action) => {
    const {error, username, conversationIDKey} = action.payload
    if (error) {
      if (
        error.typ === RPCChatTypes.ConversationErrorType.otherrekeyneeded ||
        error.typ === RPCChatTypes.ConversationErrorType.selfrekeyneeded
      ) {
        const {rekeyInfo} = error
        const participants = [
          ...(rekeyInfo
            ? new Set<string>(
                ([] as Array<string>)
                  .concat(rekeyInfo.writerNames || [], rekeyInfo.readerNames || [])
                  .filter(Boolean)
              )
            : new Set<string>(error.unverifiedTLFName.split(','))),
        ]

        const rekeyers = new Set<string>(
          error.typ === RPCChatTypes.ConversationErrorType.selfrekeyneeded
            ? [username || '']
            : (rekeyInfo && rekeyInfo.rekeyers) || []
        )
        const newMeta = Constants.unverifiedInboxUIItemToConversationMeta(error.remoteConv)
        if (!newMeta) {
          // public conversation, do nothing
          return
        }
        draftState.metaMap.set(conversationIDKey, {
          ...newMeta,
          rekeyers,
          snippet: error.message,
          snippetDecoration: RPCChatTypes.SnippetDecoration.none,
          trustedState: 'error' as const,
        })
        draftState.participantMap.set(conversationIDKey, {
          all: participants,
          contactName: Constants.noParticipantInfo.contactName,
          name: participants,
        })
      } else {
        const old = draftState.metaMap.get(conversationIDKey)
        if (old) {
          old.snippet = error.message
          old.snippetDecoration = RPCChatTypes.SnippetDecoration.none
          old.trustedState = 'error'
        }
      }
    } else {
      draftState.metaMap.delete(conversationIDKey)
    }
  },
  [Chat2Gen.metaRequestingTrusted]: (draftState, action) => {
    const {conversationIDKeys} = action.payload
    const {metaMap} = draftState
    const ids = Constants.getConversationIDKeyMetasToLoad(
      conversationIDKeys,
      metaMap as Types.State['metaMap']
    )
    ids.forEach(conversationIDKey => {
      const old = metaMap.get(conversationIDKey)
      if (old) {
        old.trustedState = 'requesting'
      }
    })
  },
  [Chat2Gen.markConversationsStale]: (draftState, action) => {
    const {updateType, conversationIDKeys} = action.payload
    const {messageMap, messageOrdinals, hasZzzJourneycard, shouldDeleteZzzJourneycard} = draftState
    if (updateType === RPCChatTypes.StaleUpdateType.clear) {
      const maps = [messageMap, messageOrdinals, hasZzzJourneycard, shouldDeleteZzzJourneycard]
      maps.forEach(m => conversationIDKeys.forEach(convID => m.delete(convID)))
    }
  },
  [Chat2Gen.notificationSettingsUpdated]: (draftState, action) => {
    const {conversationIDKey, settings} = action.payload
    const {metaMap} = draftState
    const old = metaMap.get(conversationIDKey)
    old && metaMap.set(conversationIDKey, Constants.updateMetaWithNotificationSettings(old, settings))
  },
  [Chat2Gen.metaDelete]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    draftState.metaMap.delete(conversationIDKey)
  },
  [Chat2Gen.setConversationOffline]: (draftState, action) => {
    const {conversationIDKey, offline} = action.payload
    const old = draftState.metaMap.get(conversationIDKey)
    if (old) {
      old.offline = offline
    }
  },
  [Chat2Gen.updateConvRetentionPolicy]: (draftState, action) => {
    const {meta} = action.payload
    const {metaMap} = draftState
    const newMeta = meta
    if (metaMap.has(meta.conversationIDKey)) {
      // only insert if the convo is already in the inbox
      metaMap.set(newMeta.conversationIDKey, newMeta)
    }
  },
  [Chat2Gen.updateTeamRetentionPolicy]: (draftState, action) => {
    const {metas} = action.payload
    const {metaMap} = draftState
    metas.forEach(meta => {
      if (meta && metaMap.has(meta.conversationIDKey)) {
        // only insert if the convo is already in the inbox
        metaMap.set(meta.conversationIDKey, meta)
      }
    })
  },
  [Chat2Gen.messagesExploded]: (draftState, action) => {
    const {conversationIDKey, messageIDs, explodedBy} = action.payload
    const {messageMap} = draftState
    logger.info(`messagesExploded: exploding ${messageIDs.length} messages`)
    const ordinals = messageIDs.reduce<Array<Types.Ordinal>>((arr, mid) => {
      const ord = messageIDToOrdinal(messageMap, draftState.pendingOutboxToOrdinal, conversationIDKey, mid)
      ord && arr.push(ord)
      return arr
    }, [])
    if (ordinals.length === 0) {
      // found nothing
      return
    }
    const map = messageMap.get(conversationIDKey)
    map &&
      ordinals.forEach(ordinal => {
        const m: any = map.get(ordinal) // TODO fix types
        m.exploded = true
        m.explodedBy = explodedBy || ''
        m.text = new HiddenString('')
        m.mentionsAt = new Set()
        m.reactions = new Map()
        m.unfurls = new Map()
        m.flipGameID = ''
      })
  },
  [Chat2Gen.saveMinWriterRole]: (draftState, action) => {
    const {cannotWrite, conversationIDKey, role} = action.payload
    const old = draftState.metaMap.get(conversationIDKey)
    if (old) {
      old.cannotWrite = cannotWrite
      old.minWriterRole = role
    }
  },
  [Chat2Gen.updateMessages]: (draftState, action) => {
    const {messages, conversationIDKey} = action.payload
    const {messageMap} = draftState
    messages.forEach(({messageID, message}) => {
      const ordinal = messageIDToOrdinal(
        messageMap,
        draftState.pendingOutboxToOrdinal,
        conversationIDKey,
        messageID
      )
      if (!ordinal) {
        return
      }
      const map = messageMap.get(conversationIDKey)
      if (!map) {
        return
      }

      let m = message
      if (m.ordinal !== ordinal) {
        m = {...message, ordinal}
      }
      map.set(ordinal, m)
    })
  },
  [Chat2Gen.clearMessages]: draftState => {
    const maps = [
      draftState.messageMap,
      draftState.messageOrdinals,
      draftState.hasZzzJourneycard,
      draftState.shouldDeleteZzzJourneycard,
    ]
    maps.forEach(m => m.clear())
  },
  [Chat2Gen.clearMetas]: draftState => {
    draftState.metaMap.clear()
  },
  [Chat2Gen.setInboxNumSmallRows]: (draftState, action) => {
    const {rows} = action.payload
    if (rows > 0) {
      draftState.inboxNumSmallRows = rows
    }
  },
  [Chat2Gen.setLoadedBotPage]: (draftState, action) => {
    const {page} = action.payload
    draftState.featuredBotsPage = page
  },
  [Chat2Gen.setBotPublicCommands]: (draftState, action) => {
    draftState.botPublicCommands.set(action.payload.username, action.payload.commands)
  },
  [Chat2Gen.refreshBotPublicCommands]: (draftState, action) => {
    draftState.botPublicCommands.delete(action.payload.username)
  },
  [Chat2Gen.refreshBotSettings]: (draftState, action) => {
    const m = draftState.botSettings.get(action.payload.conversationIDKey)
    if (m) {
      m.delete(action.payload.username)
    }
  },
  [Chat2Gen.showInfoPanel]: (draftState, action) => {
    const {show, tab} = action.payload
    draftState.infoPanelShowing = show
    draftState.infoPanelSelectedTab = show ? tab : undefined
  },
  [Chat2Gen.setBotSettings]: (draftState, action) => {
    const m =
      draftState.botSettings.get(action.payload.conversationIDKey) ||
      new Map<string, RPCTypes.TeamBotSettings>()
    m.set(action.payload.username, action.payload.settings)
    draftState.botSettings.set(action.payload.conversationIDKey, m)
  },
  [Chat2Gen.setGeneralConvFromTeamID]: (draftState, action) => {
    draftState.teamIDToGeneralConvID.set(action.payload.teamID, action.payload.conversationIDKey)
  },
  [Chat2Gen.navigateToThread]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    // hide search
    const toHide = [...draftState.threadSearchInfoMap.entries()].reduce<Array<Types.ConversationIDKey>>(
      (arr, [id, val]) => {
        if (id !== conversationIDKey && val.visible) {
          arr.push(id)
        }
        return arr
      },
      []
    )
    toHide.forEach(id => (draftState.threadSearchInfoMap.get(id)!.visible = false))

    // stop all audio recording
    const audioIDs = [...draftState.audioRecording.keys()]
    audioIDs.forEach(conversationIDKey => {
      stopAudioRecording(
        draftState,
        Chat2Gen.createStopAudioRecording({
          conversationIDKey,
          stopType: Types.AudioStopType.CANCEL,
        })
      )
    })
  },
  [Chat2Gen.setBotRoleInConv]: (draftState, action) => {
    const roles =
      draftState.botTeamRoleInConvMap.get(action.payload.conversationIDKey) ||
      new Map<string, TeamTypes.TeamRoleType>()
    if (action.payload.role !== undefined) {
      roles.set(action.payload.username, action.payload.role)
    } else {
      roles.delete(action.payload.username)
    }
    draftState.botTeamRoleInConvMap.set(action.payload.conversationIDKey, roles)
  },
  ...audioActions,
  ...botActions,
  ...giphyActions,
  ...paymentActions,
  ...searchActions,
  ...attachmentActions,
  ...teamBuilderReducerCreator<Types.State>(
    (draftState: Container.Draft<Types.State>, action: TeamBuildingGen.Actions) => {
      const val = editTeambuildingDraft('chat2', draftState.teamBuilding, action)
      if (val !== undefined) {
        draftState.teamBuilding = val
      }
    }
  ),
})

export default reducer
