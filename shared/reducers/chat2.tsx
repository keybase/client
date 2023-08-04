import * as Chat2Gen from '../actions/chat2-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Constants from '../constants/chat2'
import * as Container from '../util/container'
import * as Types from '../constants/types/chat2'
import logger from '../logger'

type EngineActions =
  | EngineGen.Chat1NotifyChatChatParticipantsInfoPayload
  | EngineGen.Chat1ChatUiChatBotCommandsUpdateStatusPayload
  | EngineGen.Chat1ChatUiChatInboxLayoutPayload
  | EngineGen.Chat1NotifyChatChatAttachmentDownloadCompletePayload
  | EngineGen.Chat1NotifyChatChatAttachmentDownloadProgressPayload

type Actions = Chat2Gen.Actions | EngineActions

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

const attachmentActions: Container.ActionHandler<Actions, {}> = {
  [Chat2Gen.messageAttachmentUploaded]: (_, action) => {
    const {conversationIDKey, message, placeholderID} = action.payload
    const {pendingOutboxToOrdinal, dispatch, messageMap} = Constants.getConvoState(conversationIDKey)
    const ordinal = messageIDToOrdinal(messageMap, pendingOutboxToOrdinal, placeholderID)
    if (ordinal) {
      const m = messageMap.get(ordinal)
      dispatch.updateMessage(ordinal, m ? Constants.upgradeMessage(m, message) : message)
      const subType = Constants.getMessageRenderType(message)
      Constants.getConvoState(conversationIDKey).dispatch.setMessageTypeMap(ordinal, subType)
    }
  },
  [EngineGen.chat1NotifyChatChatAttachmentDownloadComplete]: (_, action) => {
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
  },
  [EngineGen.chat1NotifyChatChatAttachmentDownloadProgress]: (_, action) => {
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
  },
  [Chat2Gen.attachmentDownloaded]: (_, action) => {
    const {message, path, error} = action.payload
    const {conversationIDKey, ordinal} = message
    const {dispatch, messageMap} = Constants.getConvoState(conversationIDKey)

    const m = messageMap.get(ordinal)
    if (m?.type === 'attachment') {
      dispatch.updateMessage(ordinal, {
        downloadPath: (!error && path) || '',
        fileURLCached: true, // assume we have this on the service now
        transferErrMsg: error,
        transferProgress: 0,
        transferState: undefined,
      })
    }
  },
}

const reducer = Container.makeReducer<Actions, {}>(
  {},
  {
    [Chat2Gen.resetStore]: () => {
      return {}
    },
    ...attachmentActions,
  }
)

export default reducer
