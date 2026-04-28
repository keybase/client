import * as Common from '@/constants/chat/common'
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import * as Styles from '@/styles'
import KB2 from '@/util/electron'
import logger from '@/logger'
import {navigateAppend} from '@/constants/router'
import {ignorePromise} from '@/constants/utils'
import {isDarwin, isIOS, isMobile} from '@/constants/platform'
import * as PlatformSpecific from '@/util/platform-specific'
import {RPCError} from '@/util/errors'
import {useCurrentUserState} from '@/stores/current-user'
import {
  useConversationThreadActions,
  useConversationThreadID,
  useConversationThreadMessageMap,
  useConversationThreadMessageOrdinalsMaybe,
  useConversationThreadPendingOutboxToOrdinal,
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

export const showAttachmentPreview = (
  conversationIDKey: T.Chat.ConversationIDKey,
  ordinal: T.Chat.Ordinal
) => {
  navigateAppend({
    name: 'chatAttachmentFullscreen',
    params: {conversationIDKey, ordinal},
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

export const useConversationAttachmentActions = () => {
  const conversationIDKey = useConversationThreadID()
  const actions = useConversationThreadActions()
  const messageMap = useConversationThreadMessageMap()
  const messageOrdinals = useConversationThreadMessageOrdinalsMaybe()
  const pendingOutboxToOrdinal = useConversationThreadPendingOutboxToOrdinal()

  const downloadAttachment = async (downloadToCache: boolean, ordinal: T.Chat.Ordinal) => {
    const messageID = messageMap.get(ordinal)?.id
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
    const old = messageMap.get(ordinal)
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
    const existing = messageMap.get(ordinal)
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
        const errString = String(err)
        logger.error('Failed to save attachment: ' + errString)
        throw new Error('Failed to save attachment: ' + errString, {cause: err})
      }
    }
    ignorePromise(f())
  }

  const messageAttachmentNativeShare = (ordinal: T.Chat.Ordinal, fromDownload = false) => {
    const message = messageMap.get(ordinal)
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
        navigateAppend({
          name: 'chatPDF',
          params: {
            conversationIDKey,
            ordinal,
            url: 'file://' + filePath,
          },
        })
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
    const fromMsg = messageMap.get(from)
    if (!fromMsg) {
      return Promise.reject(new Error('Incorrect from'))
    }
    const {deviceName, username} = useCurrentUserState.getState()
    const getLastOrdinal = () => messageOrdinals?.at(-1) ?? T.Chat.numberToOrdinal(0)
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
        if (goodMessage.outboxID && !messageMap.get(ordinal)) {
          const pendingOrdinal = pendingOutboxToOrdinal.get(goodMessage.outboxID)
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
    showAttachmentPreview: (ordinal: T.Chat.Ordinal) => showAttachmentPreview(conversationIDKey, ordinal),
  }
}
