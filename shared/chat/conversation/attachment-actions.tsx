import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import * as Styles from '@/styles'
import KB2 from '@/util/electron'
import logger from '@/logger'
import {navigateAppend} from '@/constants/router'
import {ignorePromise} from '@/constants/utils'
import {isDarwin} from '@/constants/platform'
import * as PlatformSpecific from '@/util/platform-specific'
import {RPCError} from '@/util/errors'
import {useCurrentUserState} from '@/stores/current-user'
import {
  useConversationThreadActions,
  useConversationThreadID,
  useConversationThreadStore,
} from './thread-context'

const {darwinCopyToChatTempUploadFile} = KB2.functions

export const getClientPrevFromThread = (
  messageMap: ReadonlyMap<T.Chat.Ordinal, T.Chat.Message>,
  messageOrdinals?: ReadonlyArray<T.Chat.Ordinal>
): T.Chat.MessageID => {
  for (let idx = (messageOrdinals?.length ?? 0) - 1; idx >= 0; --idx) {
    const ordinal = messageOrdinals?.[idx]
    const message = ordinal ? messageMap.get(ordinal) : undefined
    if (message?.id) {
      return message.id
    }
  }
  return T.Chat.numberToMessageID(0)
}

export const cancelAttachmentUploads = (outboxIDs: ReadonlyArray<T.RPCChat.OutboxID>) => {
  const f = async () => {
    const promises = outboxIDs.map(async outboxID =>
      T.RPCChat.localCancelUploadTempFileRpcPromise({outboxID})
    )
    await Promise.allSettled(promises)
  }
  ignorePromise(f())
}

export const makePasteAttachment = (conversationIDKey: T.Chat.ConversationIDKey, data: Uint8Array) => {
  const f = async () => {
    const outboxID = Common.generateOutboxID()
    const path = await T.RPCChat.localMakeUploadTempFileRpcPromise({
      data,
      filename: 'paste.png',
      outboxID,
    })

    navigateAppend({
      name: 'chatAttachmentGetTitles',
      params: {conversationIDKey, noDragDrop: true, pathAndOutboxIDs: [{outboxID, path}]},
    })
  }
  ignorePromise(f())
}

const attachmentPreviewMessageHandoff = new Map<string, T.Chat.MessageAttachment>()
const messageHandoffKey = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID
) => `${conversationIDKey}:${T.Chat.messageIDToNumber(messageID)}`

export const takeAttachmentPreviewMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID
) => {
  const key = messageHandoffKey(conversationIDKey, messageID)
  const message = attachmentPreviewMessageHandoff.get(key)
  attachmentPreviewMessageHandoff.delete(key)
  return message
}

export const showAttachmentPreview = (
  conversationIDKey: T.Chat.ConversationIDKey,
  message: T.Chat.MessageAttachment
) => {
  if (!T.Chat.messageIDToNumber(message.id)) {
    logger.warn('showAttachmentPreview: no message id')
    return
  }
  const key = messageHandoffKey(conversationIDKey, message.id)
  attachmentPreviewMessageHandoff.set(key, message)
  navigateAppend({
    name: 'chatAttachmentFullscreen',
    params: {conversationIDKey, messageID: message.id},
  })
}

const pdfMessageHandoff = new Map<string, T.Chat.MessageAttachment>()

export const takePDFMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  messageID: T.Chat.MessageID
) => {
  const key = messageHandoffKey(conversationIDKey, messageID)
  const message = pdfMessageHandoff.get(key)
  pdfMessageHandoff.delete(key)
  return message
}

export const showPDFViewer = (
  conversationIDKey: T.Chat.ConversationIDKey,
  message: T.Chat.MessageAttachment,
  url?: string
) => {
  if (!T.Chat.messageIDToNumber(message.id)) {
    logger.warn('showPDFViewer: no message id')
    return
  }
  const key = messageHandoffKey(conversationIDKey, message.id)
  pdfMessageHandoff.set(key, message)
  navigateAppend({
    name: 'chatPDF',
    params: url ? {conversationIDKey, messageID: message.id, url} : {conversationIDKey, messageID: message.id},
  })
}

export const uploadAttachments = (p: {
  clientPrev: T.Chat.MessageID
  conversationIDKey: T.Chat.ConversationIDKey
  ephemeralLifetime: number
  paths: ReadonlyArray<T.Chat.PathAndOutboxID>
  titles: ReadonlyArray<string>
  tlfName?: string
}) => {
  const f = async () => {
    const {clientPrev, conversationIDKey, ephemeralLifetime, paths, titles, tlfName} = p
    if (!tlfName) {
      logger.warn('attachmentsUpload: missing meta for attachment upload', conversationIDKey)
      return
    }
    const ephemeralData = ephemeralLifetime !== 0 ? {ephemeralLifetime} : {}
    const outboxIDs = paths.map(pathInfo => pathInfo.outboxID ?? Common.generateOutboxID())
    await Promise.all(
      paths.map(async (pathInfo, idx) =>
        T.RPCChat.localPostFileAttachmentLocalNonblockRpcPromise({
          arg: {
            ...ephemeralData,
            conversationID: T.Chat.keyToConversationID(conversationIDKey),
            filename: Styles.unnormalizePath(pathInfo.path),
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
            metadata: new Uint8Array(),
            outboxID: outboxIDs[idx],
            title: titles[idx] ?? '',
            tlfName,
            visibility: T.RPCGen.TLFVisibility.private,
          },
          clientPrev,
        })
      )
    )
  }
  ignorePromise(f())
}

export const uploadAttachmentsFromDragAndDrop = (p: {
  clientPrev: T.Chat.MessageID
  conversationIDKey: T.Chat.ConversationIDKey
  ephemeralLifetime: number
  paths: ReadonlyArray<T.Chat.PathAndOutboxID>
  titles: ReadonlyArray<string>
  tlfName?: string
}) => {
  const f = async () => {
    if (isDarwin && darwinCopyToChatTempUploadFile) {
      const copiedPaths = await Promise.all(
        p.paths.map(async pathInfo => {
          const outboxID = Common.generateOutboxID()
          const dst = await T.RPCChat.localGetUploadTempFileRpcPromise({
            filename: pathInfo.path,
            outboxID,
          })
          await darwinCopyToChatTempUploadFile(dst, pathInfo.path)
          return {outboxID, path: dst}
        })
      )
      uploadAttachments({...p, paths: copiedPaths})
    } else {
      uploadAttachments(p)
    }
  }
  ignorePromise(f())
}

const downloadAttachmentMessage = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  message: T.Chat.MessageAttachment,
  downloadToCache: boolean
) => {
  if (!T.Chat.messageIDToNumber(message.id)) {
    logger.warn('downloadAttachmentMessage: no message id')
    return false
  }
  try {
    const rpcRes = await T.RPCChat.localDownloadFileAttachmentLocalRpcPromise({
      conversationID: T.Chat.keyToConversationID(conversationIDKey),
      downloadToCache,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      messageID: message.id,
      preview: false,
    })
    return rpcRes.filePath
  } catch (error) {
    if (error instanceof RPCError) {
      logger.info(`downloadAttachmentMessage error: ${error.message}`)
    }
    return false
  }
}

export const attachmentDownloadMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  message: T.Chat.MessageAttachment
) => {
  if (message.downloadPath) {
    logger.warn('Attachment already downloaded')
    return
  }

  const f = async () => {
    await downloadAttachmentMessage(conversationIDKey, message, false)
  }
  ignorePromise(f())
}

export const messageAttachmentNativeSaveMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  message: T.Chat.MessageAttachment
) => {
  if (!isMobile) {
    return
  }
  const f = async () => {
    const {fileType} = message
    const fileName = await downloadAttachmentMessage(conversationIDKey, message, true)
    if (!fileName) {
      logger.info('Downloading attachment failed')
      return
    }
    try {
      logger.info('Trying to save chat attachment to camera roll')
      await PlatformSpecific.saveAttachmentToCameraRoll(fileName, fileType)
    } catch (err) {
      // saveAttachmentToCameraRoll already fired a local notification for this failure
      logger.error('Failed to save attachment: ' + String(err))
    }
  }
  ignorePromise(f())
}

export const messageAttachmentNativeShareMessage = (
  conversationIDKey: T.Chat.ConversationIDKey,
  message: T.Chat.MessageAttachment,
  fromDownload = false
) => {
  const f = async () => {
    const filePath = await downloadAttachmentMessage(conversationIDKey, message, true)
    if (!filePath) {
      logger.info('Downloading attachment failed')
      return
    }

    if (isIOS && message.fileName.endsWith('.pdf') && fromDownload) {
      showPDFViewer(conversationIDKey, message, 'file://' + filePath)
      return
    }

    try {
      await PlatformSpecific.showShareActionSheet({filePath, mimeType: message.fileType})
    } catch (_e: unknown) {
      const e = _e as undefined | {message: string}
      logger.error('Failed to share attachment: ' + JSON.stringify(e?.message))
    }
  }
  ignorePromise(f())
}

export const loadNextAttachmentMessage = async (
  conversationIDKey: T.Chat.ConversationIDKey,
  fromMsg: T.Chat.MessageAttachment,
  backInTime: boolean
) => {
  const {deviceName, username} = useCurrentUserState.getState()
  const result = await T.RPCChat.localGetNextAttachmentMessageLocalRpcPromise({
    assetTypes: [T.RPCChat.AssetMetadataType.image, T.RPCChat.AssetMetadataType.video],
    backInTime,
    convID: T.Chat.keyToConversationID(conversationIDKey),
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
    messageID: fromMsg.id,
  })

  if (result.message) {
    const goodMessage = Message.uiMessageToMessage(
      conversationIDKey,
      result.message,
      username,
      () => fromMsg.ordinal,
      deviceName
    )
    if (goodMessage?.type === 'attachment') {
      return goodMessage
    }
  }
  return Promise.reject(new Error('No more results'))
}

export const useConversationAttachmentActions = () => {
  const conversationIDKey = useConversationThreadID()
  const actions = useConversationThreadActions()
  // Read thread state lazily at call time. Callers (TransferIcon etc) render per
  // message row, so subscribing to messageMap here would re-render every one of
  // them on every thread change.
  const threadStore = useConversationThreadStore()

  const downloadAttachment = async (downloadToCache: boolean, ordinal: T.Chat.Ordinal) => {
    const messageID = threadStore.getState().messageMap.get(ordinal)?.id
    if (!messageID) {
      return false
    }
    try {
      const rpcRes = await T.RPCChat.localDownloadFileAttachmentLocalRpcPromise({
        conversationID: T.Chat.keyToConversationID(conversationIDKey),
        downloadToCache,
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        messageID,
        preview: false,
      })

      actions.finishAttachmentDownload(ordinal, rpcRes.filePath)
      return rpcRes.filePath
    } catch (error) {
      const errMsg =
        error instanceof RPCError
          ? error.message || 'Error downloading attachment'
          : 'Error downloading attachment'
      if (error instanceof RPCError) {
        logger.info(`downloadAttachment error: ${error.message}`)
      }
      actions.failAttachmentDownload(ordinal, errMsg)
      return false
    }
  }

  const attachmentDownload = (ordinal: T.Chat.Ordinal) => {
    const old = threadStore.getState().messageMap.get(ordinal)
    if (!old) {
      return
    }

    if (old.type !== 'attachment') {
      actions.startAttachmentDownload(ordinal)
      return
    }

    if (old.downloadPath) {
      logger.warn('Attachment already downloaded')
      return
    }

    actions.startAttachmentDownload(ordinal)
    const f = async () => {
      await downloadAttachment(false, ordinal)
    }
    ignorePromise(f())
  }

  const messageAttachmentNativeSave = (ordinal: T.Chat.Ordinal) => {
    if (!isMobile) {
      return
    }
    const existing = threadStore.getState().messageMap.get(ordinal)
    if (existing?.type !== 'attachment') {
      throw new Error('Invalid share message')
    }

    const f = async () => {
      const {fileType} = existing
      const fileName = await downloadAttachment(true, ordinal)
      if (!fileName) {
        logger.info('Downloading attachment failed')
        return
      }
      try {
        actions.setAttachmentMobileSaving(ordinal, true)
        logger.info('Trying to save chat attachment to camera roll')
        await PlatformSpecific.saveAttachmentToCameraRoll(fileName, fileType)
        actions.setAttachmentMobileSaving(ordinal, false)
      } catch (err) {
        const errString = err instanceof Error ? err.message : String(err)
        logger.error('Failed to save attachment: ' + errString)
        actions.failAttachmentDownload(ordinal, 'Failed to save attachment: ' + errString)
      }
    }
    ignorePromise(f())
  }

  const messageAttachmentNativeShare = (ordinal: T.Chat.Ordinal, fromDownload = false) => {
    const message = threadStore.getState().messageMap.get(ordinal)
    if (message?.type !== 'attachment') {
      throw new Error('Invalid share message')
    }
    const f = async () => {
      const filePath = await downloadAttachment(true, ordinal)
      if (!filePath) {
        logger.info('Downloading attachment failed')
        return
      }

      if (isIOS && message.fileName.endsWith('.pdf') && fromDownload) {
        showPDFViewer(conversationIDKey, message, 'file://' + filePath)
        return
      }

      try {
        await PlatformSpecific.showShareActionSheet({filePath, mimeType: message.fileType})
      } catch (_e: unknown) {
        const e = _e as undefined | {message: string}
        logger.error('Failed to share attachment: ' + JSON.stringify(e?.message))
      }
    }
    ignorePromise(f())
  }

  const loadNextAttachment = async (from: T.Chat.Ordinal, backInTime: boolean) => {
    const fromMsg = threadStore.getState().messageMap.get(from)
    if (!fromMsg) {
      return Promise.reject(new Error('Incorrect from'))
    }
    const {deviceName, username} = useCurrentUserState.getState()
    const getLastOrdinal = () => threadStore.getState().messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
    const result = await T.RPCChat.localGetNextAttachmentMessageLocalRpcPromise({
      assetTypes: [T.RPCChat.AssetMetadataType.image, T.RPCChat.AssetMetadataType.video],
      backInTime,
      convID: T.Chat.keyToConversationID(conversationIDKey),
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      messageID: fromMsg.id,
    })

    if (result.message) {
      const goodMessage = Message.uiMessageToMessage(
        conversationIDKey,
        result.message,
        username,
        getLastOrdinal,
        deviceName
      )
      if (goodMessage?.type === 'attachment') {
        actions.addMessages([goodMessage])
        let ordinal = goodMessage.ordinal
        if (goodMessage.outboxID && !threadStore.getState().messageMap.get(ordinal)) {
          const pendingOrdinal = threadStore.getState().pendingOutboxToOrdinal.get(goodMessage.outboxID)
          if (pendingOrdinal) {
            ordinal = pendingOrdinal
          }
        }
        return ordinal
      }
    }
    return Promise.reject(new Error('No more results'))
  }

  return {
    attachmentDownload,
    loadNextAttachment,
    messageAttachmentNativeSave,
    messageAttachmentNativeShare,
    showAttachmentPreview: (ordinal: T.Chat.Ordinal, message?: T.Chat.MessageAttachment) => {
      const existing = threadStore.getState().messageMap.get(ordinal)
      const initialMessage = message ?? (existing?.type === 'attachment' ? existing : undefined)
      if (initialMessage) {
        showAttachmentPreview(conversationIDKey, initialMessage)
      }
    },
  }
}
