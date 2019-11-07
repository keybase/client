import * as Chat2Gen from '../actions/chat2-gen'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import * as I from 'immutable'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/chat2'
import teamBuildingReducer from './team-building'
import {isMobile} from '../constants/platform'
import logger from '../logger'
import HiddenString from '../util/hidden-string'
import partition from 'lodash/partition'
import shallowEqual from 'shallowequal'

type EngineActions =
  | EngineGen.Chat1NotifyChatChatTypingUpdatePayload
  | EngineGen.Chat1ChatUiChatBotCommandsUpdateStatusPayload
  | EngineGen.Chat1ChatUiChatInboxLayoutPayload

type Actions = Chat2Gen.Actions | TeamBuildingGen.Actions | EngineActions

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
  let m = map && map.get(Types.numberToOrdinal(messageID))
  if (m && m.id && m.id === messageID) {
    return m.ordinal
  }
  // Search through our sent messages
  const pendingOrdinal = [
    ...(pendingOutboxToOrdinal.get(conversationIDKey) || new Map<Types.OutboxID, Types.Ordinal>()).values(),
  ].find(o => {
    m = map && map.get(o)
    if (m && m.id && m.id === messageID) {
      return true
    }
    return false
  })

  if (pendingOrdinal) {
    return pendingOrdinal
  }

  return null
}

const passToTeamBuildingReducer = (
  draftState: Container.Draft<Types.State>,
  action: TeamBuildingGen.Actions
) => {
  draftState.teamBuilding = teamBuildingReducer(
    'chat2',
    draftState.teamBuilding as Types.State['teamBuilding'],
    action
  )
}

const teamActions: Container.ActionHandler<Actions, Types.State> = {
  [TeamBuildingGen.resetStore]: passToTeamBuildingReducer,
  [TeamBuildingGen.cancelTeamBuilding]: passToTeamBuildingReducer,
  [TeamBuildingGen.addUsersToTeamSoFar]: passToTeamBuildingReducer,
  [TeamBuildingGen.removeUsersFromTeamSoFar]: passToTeamBuildingReducer,
  [TeamBuildingGen.searchResultsLoaded]: passToTeamBuildingReducer,
  [TeamBuildingGen.finishedTeamBuilding]: passToTeamBuildingReducer,
  [TeamBuildingGen.fetchedUserRecs]: passToTeamBuildingReducer,
  [TeamBuildingGen.fetchUserRecs]: passToTeamBuildingReducer,
  [TeamBuildingGen.search]: passToTeamBuildingReducer,
  [TeamBuildingGen.selectRole]: passToTeamBuildingReducer,
  [TeamBuildingGen.labelsSeen]: passToTeamBuildingReducer,
  [TeamBuildingGen.changeSendNotification]: passToTeamBuildingReducer,
}

const audioActions: Container.ActionHandler<Actions, Types.State> = {
  [Chat2Gen.enableAudioRecording]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    draftState.audioRecording.set(conversationIDKey, Constants.makeAudioRecordingInfo())
  },
  [Chat2Gen.stopAudioRecording]: (draftState, action) => {
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
  },
  [Chat2Gen.lockAudioRecording]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {audioRecording} = draftState
    const info = audioRecording.get(conversationIDKey) || Constants.makeAudioRecordingInfo()
    audioRecording.set(conversationIDKey, info)
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
    const convMap = accountsInfoMap.get(conversationIDKey) || new Map()
    accountsInfoMap.set(conversationIDKey, convMap)
    convMap.set(messageID, paymentInfo)
    paymentStatusMap.set(paymentInfo.paymentID, paymentInfo)
  },
}

const searchActions: Container.ActionHandler<Actions, Types.State> = {
  [Chat2Gen.setChannelSearchText]: (draftState, action) => {
    const {text} = action.payload
    draftState.channelSearchText = text.toLowerCase()
  },
  [Chat2Gen.threadSearchResults]: (draftState, action) => {
    const {conversationIDKey, clear, messages} = action.payload
    const {threadSearchInfoMap} = draftState
    const info = threadSearchInfoMap.get(conversationIDKey) || Constants.makeThreadSearchInfo()
    threadSearchInfoMap.set(conversationIDKey, info)
    info.hits = clear ? messages : [...info.hits, ...messages]
  },
  [Chat2Gen.setThreadSearchStatus]: (draftState, action) => {
    const {conversationIDKey, status} = action.payload
    const {threadSearchInfoMap} = draftState
    const info = threadSearchInfoMap.get(conversationIDKey) || Constants.makeThreadSearchInfo()
    threadSearchInfoMap.set(conversationIDKey, info)
    info.status = status
  },
  [Chat2Gen.toggleThreadSearch]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {threadSearchInfoMap, messageCenterOrdinals} = draftState
    const info = threadSearchInfoMap.get(conversationIDKey) || Constants.makeThreadSearchInfo()
    threadSearchInfoMap.set(conversationIDKey, info)
    info.hits = []
    info.status = 'initial'
    info.visible = !info.visible

    messageCenterOrdinals.delete(conversationIDKey)
  },
  [Chat2Gen.threadSearch]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {threadSearchInfoMap} = draftState
    const info = threadSearchInfoMap.get(action.payload.conversationIDKey) || Constants.makeThreadSearchInfo()
    threadSearchInfoMap.set(conversationIDKey, info)
    info.hits = []
  },
  [Chat2Gen.setThreadSearchQuery]: (draftState, action) => {
    const {conversationIDKey, query} = action.payload
    const {threadSearchQueryMap} = draftState
    threadSearchQueryMap.set(conversationIDKey, query)
  },
  [Chat2Gen.inboxSearchSetTextStatus]: (draftState, action) => {
    const {status} = action.payload
    const inboxSearch = draftState.inboxSearch || Constants.makeInboxSearchInfo()
    draftState.inboxSearch = inboxSearch
    inboxSearch.textStatus = status
  },
  [Chat2Gen.inboxSearchSetIndexPercent]: (draftState, action) => {
    const {percent} = action.payload
    const {inboxSearch} = draftState
    if (inboxSearch && inboxSearch.textStatus === 'inprogress') {
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
    }
  },
  [Chat2Gen.inboxSearchNameResults]: (draftState, action) => {
    const {inboxSearch} = draftState
    if (inboxSearch && inboxSearch.nameStatus === 'inprogress') {
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
    const viewMap = attachmentViewMap.get(conversationIDKey) || new Map()
    attachmentViewMap.set(conversationIDKey, viewMap)

    const info = viewMap.get(viewType) || Constants.initialAttachmentViewInfo
    viewMap.set(viewType, info)
    info.status = 'loading'
  },
  [Chat2Gen.addAttachmentViewMessage]: (draftState, action) => {
    const {conversationIDKey, viewType, message} = action.payload
    const {attachmentViewMap} = draftState
    const viewMap = attachmentViewMap.get(conversationIDKey) || new Map()
    attachmentViewMap.set(conversationIDKey, viewMap)

    const info = viewMap.get(viewType) || Constants.initialAttachmentViewInfo
    viewMap.set(viewType, info)

    if (info.messages.findIndex((item: any) => item.id === action.payload.message.id) < 0) {
      info.messages = info.messages.concat(message).sort((l: any, r: any) => r.id - l.id)
    }
  },
  [Chat2Gen.setAttachmentViewStatus]: (draftState, action) => {
    const {conversationIDKey, viewType, last, status} = action.payload
    const {attachmentViewMap} = draftState
    const viewMap = attachmentViewMap.get(conversationIDKey) || new Map()
    attachmentViewMap.set(conversationIDKey, viewMap)

    const info = viewMap.get(viewType) || Constants.initialAttachmentViewInfo
    viewMap.set(viewType, info)

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
      const m = map && map.get(ordinal)
      if (map && m && m.type === 'attachment') {
        map.set(ordinal, m.set('transferProgress', ratio).set('transferState', 'uploading'))
      }
    }
  },
  [Chat2Gen.attachmentUploaded]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState
    const map = messageMap.get(conversationIDKey)
    const m = map && map.get(ordinal)
    if (map && m && m.type === 'attachment') {
      map.set(ordinal, m.set('transferProgress', 0).set('transferState', null))
    }
  },
  [Chat2Gen.attachmentMobileSave]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState

    const map = messageMap.get(conversationIDKey)
    const m = map && map.get(ordinal)
    if (map && m && m.type === 'attachment') {
      map.set(ordinal, m.set('transferState', 'mobileSaving').set('transferErrMsg', null))
    }
  },
  [Chat2Gen.attachmentMobileSaved]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState
    const map = messageMap.get(conversationIDKey)
    const m = map && map.get(ordinal)
    if (map && m && m.type === 'attachment') {
      map.set(ordinal, m.set('transferState', null).set('transferErrMsg', null))
    }
  },
  [Chat2Gen.attachmentDownload]: (draftState, action) => {
    const {message} = action.payload
    const {messageMap} = draftState
    const map = messageMap.get(message.conversationIDKey)
    const m = map && map.get(message.ordinal)
    if (map && m && m.type === 'attachment') {
      map.set(message.ordinal, m.set('transferState', 'downloading').set('transferErrMsg', null))
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
      const map = messageMap.get(conversationIDKey) || new Map<Types.Ordinal, Types.Message>()
      messageMap.set(conversationIDKey, map)

      const m = map.get(ordinal)
      map.set(ordinal, m ? Constants.upgradeMessage(m, message) : message)
    }
  },
  [Chat2Gen.attachmentFullscreenSelection]: (draftState, action) => {
    const {autoPlay, message} = action.payload
    draftState.attachmentFullscreenSelection = {autoPlay, message}
  },
  [Chat2Gen.attachmentLoading]: (draftState, action) => {
    const {conversationIDKey, message, isPreview, ratio} = action.payload
    const {attachmentFullscreenSelection, attachmentViewMap, messageMap} = draftState
    if (
      attachmentFullscreenSelection &&
      attachmentFullscreenSelection.message.conversationIDKey === message.conversationIDKey &&
      attachmentFullscreenSelection.message.id === message.id &&
      message.type === 'attachment'
    ) {
      attachmentFullscreenSelection.message = message
        .set('transferState', 'downloading')
        .set('transferProgress', action.payload.ratio)
    }

    const viewType = RPCChatTypes.GalleryItemTyp.doc
    const viewMap = attachmentViewMap.get(conversationIDKey) || new Map()
    attachmentViewMap.set(conversationIDKey, viewMap)

    const info = viewMap.get(viewType) || Constants.initialAttachmentViewInfo
    viewMap.set(viewType, info)
    const {messages} = info
    const idx = messages.findIndex(item => item.id === message.id)
    if (idx !== -1) {
      const m: Types.MessageAttachment = messages[idx] as any // TODO don't cast
      messages[idx] = m.set('transferState', 'downloading').set('transferProgress', action.payload.ratio)
    }

    const map = messageMap.get(conversationIDKey)
    const m = map && map.get(message.ordinal)
    if (map && m && m.type === 'attachment') {
      map.set(
        message.ordinal,
        isPreview
          ? m.set('previewTransferState', 'downloading')
          : m
              .set('transferProgress', ratio)
              .set('transferState', 'downloading')
              .set('transferErrMsg', null)
      )
    }
  },
  [Chat2Gen.attachmentDownloaded]: (draftState, action) => {
    const {message, path, error} = action.payload
    const {conversationIDKey, ordinal} = message
    const {attachmentFullscreenSelection, messageMap} = draftState
    if (
      !error &&
      attachmentFullscreenSelection &&
      attachmentFullscreenSelection.message.conversationIDKey === message.conversationIDKey &&
      attachmentFullscreenSelection.message.id === message.id &&
      message.type === 'attachment'
    ) {
      attachmentFullscreenSelection.message = message.set('downloadPath', path || null)
    }

    const {attachmentViewMap} = draftState
    const viewMap = attachmentViewMap.get(conversationIDKey) || new Map()
    attachmentViewMap.set(conversationIDKey, viewMap)

    const viewType = RPCChatTypes.GalleryItemTyp.doc
    const info = viewMap.get(viewType) || Constants.initialAttachmentViewInfo
    viewMap.set(viewType, info)

    const {messages} = info
    const idx = messages.findIndex(item => item.id === message.id)
    if (idx !== -1) {
      const m: Types.MessageAttachment = messages[idx] as any // TODO don't cast
      messages[idx] = m.merge({
        downloadPath: path,
        fileURLCached: true,
        transferProgress: 0,
        transferState: null,
      })
    }

    const map = messageMap.get(conversationIDKey)
    const m = map && map.get(ordinal)
    if (map && m && m.type === 'attachment') {
      map.set(
        ordinal,
        m
          .set('downloadPath', (!error && path) || '')
          .set('transferProgress', 0)
          .set('transferState', null)
          .set('transferErrMsg', error ? error || 'Error downloading attachment' : null)
          .set('fileURLCached', true) // assume we have this on the service now
      )
    }
  },
}

const reducer = Container.makeReducer<Actions, Types.State>(initialState, {
  [Chat2Gen.resetStore]: draftState => {
    return {...initialState, staticConfig: draftState.staticConfig as Types.State['staticConfig']}
  },
  [Chat2Gen.setInboxShowIsNew]: (draftState, action) => {
    draftState.inboxShowNew = action.payload.isNew
  },
  [Chat2Gen.toggleSmallTeamsExpanded]: draftState => {
    draftState.smallTeamsExpanded = !draftState.smallTeamsExpanded
  },
  [Chat2Gen.changeFocus]: (draftState, action) => {
    draftState.focus = action.payload.nextFocus
  },
  [Chat2Gen.selectConversation]: (draftState, action) => {
    const {conversationIDKey} = action.payload
    const {selectedConversation, threadLoadStatus, containsLatestMessageMap, orangeLineMap} = draftState
    const {metaMap, messageCenterOrdinals} = draftState
    // ignore non-changing
    if (selectedConversation === conversationIDKey) {
      return
    }

    if (conversationIDKey) {
      const {readMsgID, maxVisibleMsgID} = metaMap.get(conversationIDKey) || Constants.makeConversationMeta()

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
        const message = ord && messageMap && messageMap.get(ord)
        if (message && message.id) {
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
    const meta = metaMap.get(selectedConversation)
    if (meta) {
      meta.draft = ''
    }
    messageCenterOrdinals.delete(conversationIDKey)
    threadLoadStatus.delete(conversationIDKey)
    containsLatestMessageMap.set(conversationIDKey, true)
    draftState.previousSelectedConversation = selectedConversation
    draftState.selectedConversation = conversationIDKey
    if (Constants.isValidConversationIDKey(conversationIDKey)) {
      // If navigating away from error conversation to a valid conv - clear
      // error msg.
      draftState.createConversationError = null
    }
  },
  [Chat2Gen.conversationErrored]: (draftState, action) => {
    draftState.createConversationError = action.payload.message
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

    const map = unfurlPromptMap.get(conversationIDKey) || new Map()
    unfurlPromptMap.set(conversationIDKey, map)

    const prompts = map.get(messageID) || new Set()
    map.set(messageID, prompts)

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
    const {conversations} = action.payload
    const badgeKey = String(isMobile ? RPCTypes.DeviceType.mobile : RPCTypes.DeviceType.desktop)
    const badgeMap = new Map<Types.ConversationIDKey, number>()
    const unreadMap = new Map<Types.ConversationIDKey, number>()
    conversations.forEach(({convID, badgeCounts, unreadMessages}) => {
      const key = Types.conversationIDToKey(convID)
      const count = badgeCounts[badgeKey] || 0
      badgeMap.set(key, count)
      unreadMap.set(key, unreadMessages)
    })
    draftState.badgeMap = badgeMap
    draftState.unreadMap = unreadMap
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
      const message = messageMap && messageMap.get(ordinal)
      if (message && message.type === 'text') {
        editingMap.set(conversationIDKey, ordinal)
      }
      return
    }

    // Editing your last message
    const ordinals = [...(messageOrdinals.get(conversationIDKey) || [])]
    const found = ordinals.reverse().find(o => {
      const message = messageMap && messageMap.get(o)
      return !!(
        message &&
        message.type === 'text' &&
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
  [Chat2Gen.messagesAdd]: (draftState, action) => {
    const {context, shouldClearOthers} = action.payload
    // pull out deletes and handle at the end
    const [messages, deletedMessages] = partition(action.payload.messages, m => m.type !== 'deleted')
    // we want the clear applied when we call findExisting
    const messageOrdinals = new Map(draftState.messageOrdinals)
    const oldPendingOutboxToOrdinal = new Map(draftState.pendingOutboxToOrdinal)
    const oldMessageMap = new Map(draftState.messageMap)

    // so we can keep messages if they haven't mutated
    const previousMessageMap = new Map(draftState.messageMap)

    // first group into convoid
    const convoToMessages: {[K in string]: Array<Types.Message>} = messages.reduce((map: any, m) => {
      const key = String(m.conversationIDKey)
      map[key] = map[key] || []
      map[key].push(m)
      return map
    }, {})
    const convoToDeletedOrdinals: {[K in string]: Set<Types.Ordinal>} = deletedMessages.reduce(
      (map: any, m) => {
        const key = String(m.conversationIDKey)
        // @ts-ignore
        map[key] = map[key] || new Set()
        // @ts-ignore
        map[key].add(m.ordinal)
        return map
      },
      {}
    )

    if (shouldClearOthers) {
      Object.keys(convoToMessages).forEach(cid =>
        messageOrdinals.delete(Types.stringToConversationIDKey(cid))
      )
      Object.keys(convoToMessages).forEach(cid =>
        oldPendingOutboxToOrdinal.delete(Types.stringToConversationIDKey(cid))
      )
      Object.keys(convoToMessages).forEach(cid => oldMessageMap.delete(Types.stringToConversationIDKey(cid)))
    }

    // Types we can send and have to deal with outbox ids
    const canSendType = (m: Types.Message): Types.MessageText | null | Types.MessageAttachment | null =>
      m.type === 'text' || m.type === 'attachment' ? m : null

    // Update any pending messages
    const pendingOutboxToOrdinal = new Map(oldPendingOutboxToOrdinal)
    if (context.type === 'sent' || context.type === 'threadLoad' || context.type === 'incoming') {
      messages.forEach(message => {
        const m = canSendType(message)
        if (m && !m.id && m.outboxID) {
          const outToOrd = new Map(pendingOutboxToOrdinal.get(m.conversationIDKey) || [])
          outToOrd.set(m.outboxID, m.ordinal)
          pendingOutboxToOrdinal.set(m.conversationIDKey, outToOrd)
        }
      })
    }

    const findExistingSentOrPending = (
      conversationIDKey: Types.ConversationIDKey,
      m: Types.MessageText | Types.MessageAttachment
    ) => {
      // something we sent
      if (m.outboxID) {
        // and we know about it
        const outMap = oldPendingOutboxToOrdinal.get(conversationIDKey)
        const ordinal = outMap && outMap.get(m.outboxID)
        if (ordinal) {
          const map = oldMessageMap.get(conversationIDKey)
          return map ? map.get(ordinal) : undefined
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
        return map ? map.get(pendingOrdinal) : undefined
      }
      return null
    }

    Object.keys(convoToDeletedOrdinals).forEach(cid => {
      const conversationIDKey = Types.stringToConversationIDKey(cid)
      const os = messageOrdinals.get(conversationIDKey) || new Set()
      convoToDeletedOrdinals[conversationIDKey].forEach(o => os.delete(o))
      messageOrdinals.set(conversationIDKey, os)
    })

    Object.keys(convoToMessages).forEach(cid => {
      const conversationIDKey = Types.stringToConversationIDKey(cid)
      const messages = convoToMessages[cid]
      const removedOrdinals: Array<Types.Ordinal> = []
      const ordinals = messages.reduce<Array<Types.Ordinal>>((arr, message) => {
        const m = canSendType(message)
        if (m) {
          // Sendable so we might have an existing message
          if (!findExistingSentOrPending(conversationIDKey, m)) {
            arr.push(m.ordinal)
          }
          // We might have a placeholder for this message in there with ordinal of its own ID, let's
          // get rid of it if that is the case
          if (m.id) {
            const map = oldMessageMap.get(conversationIDKey)
            const oldMsg = map ? map.get(Types.numberToOrdinal(m.id)) : undefined
            if (oldMsg && oldMsg.type === 'placeholder' && oldMsg.ordinal !== m.ordinal) {
              removedOrdinals.push(oldMsg.ordinal)
            }
          }
        } else if (message.type === 'placeholder') {
          // sometimes we send then get a placeholder for that send. Lets see if we already have the message id for the sent
          // and ignore the placeholder in that instance
          logger.info(`Got placeholder message with id: ${message.id}`)
          const existingOrdinal = messageIDToOrdinal(
            oldMessageMap,
            pendingOutboxToOrdinal,
            conversationIDKey,
            message.id
          )
          if (!existingOrdinal) {
            arr.push(message.ordinal)
          } else {
            logger.info(`Skipping placeholder for message with id ${message.id} because already exists`)
          }
        } else {
          arr.push(message.ordinal)
        }
        return arr
      }, [])

      // add new ones, remove deleted ones, sort
      const os = new Set(messageOrdinals.get(conversationIDKey) || [])
      removedOrdinals.forEach(o => os.delete(o))
      messageOrdinals.set(conversationIDKey, new Set([...os, ...ordinals].sort((a, b) => a - b)))
    })

    const messageMap = new Map(oldMessageMap)
    Object.keys(convoToDeletedOrdinals).forEach(cid => {
      const conversationIDKey = Types.stringToConversationIDKey(cid)
      const map = messageMap.get(conversationIDKey)
      if (map) {
        convoToDeletedOrdinals[conversationIDKey].forEach(k => map.delete(k))
      }
    })

    Object.keys(convoToMessages).forEach(cid => {
      const conversationIDKey = Types.stringToConversationIDKey(cid)
      const messages = convoToMessages[cid]
      messages.forEach(message => {
        const m = canSendType(message)
        const oldSentOrPending = m ? findExistingSentOrPending(conversationIDKey, m) : null
        let toSet
        if (oldSentOrPending) {
          toSet = Constants.upgradeMessage(oldSentOrPending, message)
        } else {
          const map = previousMessageMap.get(conversationIDKey)
          toSet = Constants.mergeMessage((m && map && map.get(m.ordinal)) || null, message)
        }
        const map = messageMap.get(conversationIDKey) || new Map<Types.Ordinal, Types.Message>()
        messageMap.set(conversationIDKey, map)
        map.set(toSet.ordinal, toSet)
      })
    })

    const containsLatestMessageMap = new Map(draftState.containsLatestMessageMap)
    Object.keys(convoToMessages).forEach(cid => {
      const conversationIDKey = Types.stringToConversationIDKey(cid)
      if (!action.payload.forceContainsLatestCalc && containsLatestMessageMap.get(conversationIDKey)) {
        return
      }
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
    })
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
    const map = messageMap.get(conversationIDKey)
    if (!map) {
      return
    }
    const m = map.get(ordinal)
    if (!m) {
      return
    }
    if (m.type === 'text') {
      map.set(ordinal, m.set('errorReason', null).set('submitState', 'pending'))
    }
    if (m.type === 'attachment') {
      map.set(ordinal, m.set('errorReason', null).set('submitState', 'pending'))
    }
  },
  [Chat2Gen.messageErrored]: (draftState, action) => {
    const {conversationIDKey, errorTyp, outboxID, reason} = action.payload
    const {pendingOutboxToOrdinal, messageMap} = draftState
    const outToOrd = pendingOutboxToOrdinal.get(conversationIDKey)
    const ordinal = outToOrd && outToOrd.get(outboxID)
    if (!ordinal) {
      return
    }
    const map = messageMap.get(conversationIDKey)
    if (!map) {
      return
    }
    const m = map.get(ordinal)
    if (!m) {
      return
    }

    if (m.type === 'text') {
      map.set(
        ordinal,
        m
          .set('errorReason', reason)
          .set('submitState', 'failed')
          .set('errorTyp', errorTyp)
      )
    }
    if (m.type === 'attachment') {
      map.set(
        ordinal,
        m
          .set('errorReason', reason)
          .set('submitState', 'failed')
          .set('errorTyp', errorTyp)
      )
    }
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
    const {botCommandsUpdateStatusMap} = draftState
    botCommandsUpdateStatusMap.set(Types.stringToConversationIDKey(convID), status)
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
    const {conversationIDKey, emoji, targetOrdinal, username} = action.payload
    const {messageMap} = draftState

    const map = messageMap.get(conversationIDKey)
    if (map) {
      const m: any = map.get(targetOrdinal)
      if (m && Constants.isDecoratedMessage(m)) {
        const reactions = m.reactions
        // @ts-ignore thinks `message` is the inner type
        map.set(
          targetOrdinal,
          // @ts-ignore
          m.set(
            'reactions',
            reactions.withMutations(reactionMap => {
              reactionMap.update(emoji, I.Set(), rs => {
                const existing = rs.find(r => r.username === username)
                if (existing) {
                  // found an existing reaction. remove it from our list
                  return rs.delete(existing)
                }
                // no existing reaction. add this one to the map
                return rs.add(Constants.makeReaction({timestamp: Date.now(), username}))
              })
              const newSet = reactionMap.get(emoji)
              if (newSet && newSet.size === 0) {
                reactionMap.delete(emoji)
              }
            })
          )
        )
      }
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
            `updateReactions: couldn't find target ordinal for targetMsgID=${
              td.targetMsgID
            } in convID=${conversationIDKey}`
          )
          return
        }
        const m = map.get(td.targetOrdinal)
        if (m && m.type !== 'deleted' && m.type !== 'placeholder') {
          // @ts-ignore TODO fix type
          map.set(td.targetOrdinal, m.set('reactions', td.reactions))
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

    const allOrdinals = I.Set(
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
    const mode = explodingModes.get(conversationIDKey) || 0
    // we already have the new mode in `explodingModes`, if we've already locked it we shouldn't update
    const alreadyLocked = (explodingModeLocks.get(conversationIDKey) || null) !== null
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
  [Chat2Gen.metasReceived]: (draftState, action) => {
    const {fromInboxRefresh, metas, initialTrustedLoad, removals} = action.payload
    const {draftMap, mutedMap, metaMap} = draftState
    if (fromInboxRefresh) {
      draftState.inboxHasLoaded = true
    }
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
  [Chat2Gen.handleSeeingWallets]: draftState => {
    draftState.isWalletsNew = false
  },
  [Chat2Gen.setWalletsOld]: draftState => {
    draftState.isWalletsNew = false
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
    const m = map && map.get(ordinal)
    if (map && m && m.type === 'text') {
      map.set(ordinal, m.set('submitState', 'deleting'))
    }
  },
  [Chat2Gen.messageEdit]: (draftState, action) => {
    const {conversationIDKey, ordinal} = action.payload
    const {messageMap} = draftState

    const map = messageMap.get(conversationIDKey)
    const m = map && map.get(ordinal)
    if (map && m && m.type === 'text') {
      map.set(ordinal, m.set('submitState', 'editing'))
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
      const map = messageMap.get(conversationIDKey)
      const m = map && map.get(ordinal)
      if (map && m && m.type === 'text') {
        map.set(
          ordinal,
          m
            .set('text', text)
            .set('hasBeenEdited', true)
            .set('submitState', null)
            .set('mentionsAt', mentionsAt)
            .set('mentionsChannel', mentionsChannel)
            .set('mentionsChannelName', mentionsChannelName)
        )
      }
    }
  },
  [Chat2Gen.pendingMessageWasEdited]: (draftState, action) => {
    const {conversationIDKey, ordinal, text} = action.payload
    const {messageMap} = draftState

    const map = messageMap.get(conversationIDKey)
    const m = map && map.get(ordinal)
    if (map && m && m.type === 'text') {
      map.set(ordinal, m.set('text', text))
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
          participants,
          rekeyers,
          snippet: error.message,
          snippetDecoration: '',
          trustedState: 'error' as const,
        })
      } else {
        const old = draftState.metaMap.get(conversationIDKey)
        if (old) {
          old.snippet = error.message
          old.snippetDecoration = ''
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
    const {messageMap, messageOrdinals} = draftState
    if (updateType === RPCChatTypes.StaleUpdateType.clear) {
      conversationIDKeys.forEach(k => messageMap.delete(k))
      conversationIDKeys.forEach(o => messageOrdinals.delete(o))
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
        m &&
          map.set(
            ordinal,
            m
              .set('exploded', true)
              .set('explodedBy', explodedBy || '')
              .set('text', new HiddenString(''))
              .set('mentionsAt', I.Set())
              .set('reactions', I.Map())
              .set('unfurls', I.Map())
              .set('flipGameID', '')
          )
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
    const updateOrdinals = messages.reduce<Array<{msg: Types.Message; ordinal: Types.Ordinal}>>((l, msg) => {
      const ordinal = messageIDToOrdinal(
        messageMap,
        draftState.pendingOutboxToOrdinal,
        action.payload.conversationIDKey,
        msg.messageID
      )
      if (!ordinal) {
        return l
      }
      // @ts-ignore TODO Fix not sure whats up
      const m: Types.Message = msg.message.set('ordinal', ordinal)
      return l.concat({msg: m, ordinal})
    }, [])

    const map = messageMap.get(conversationIDKey)
    if (map) {
      updateOrdinals.forEach(r => {
        map.set(r.ordinal, r.msg)
      })
    }
  },
  [Chat2Gen.clearMessages]: draftState => {
    draftState.messageMap.clear()
    draftState.messageOrdinals.clear()
  },
  [Chat2Gen.clearMetas]: draftState => {
    draftState.metaMap.clear()
  },
  ...teamActions,
  ...audioActions,
  ...giphyActions,
  ...paymentActions,
  ...searchActions,
  ...attachmentActions,
})

export default reducer
