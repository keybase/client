import * as React from 'react'
import * as C from '@/constants'
import {clampImageSize} from '@/constants/chat/helpers'
import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import logger from '@/logger'
import {maxWidth, maxHeight} from '@/chat/conversation/messages/attachment/shared'
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'
import {
  attachmentDownloadMessage,
  loadNextAttachmentMessage,
} from '@/chat/conversation/attachment-actions'
import {showConversationInfoPanel} from '@/chat/conversation/thread-context'
import {useConversationMessage} from '@/chat/conversation/data-hooks'

const blankMessage = Chat.makeMessageAttachment({})
export const useData = (
  conversationIDKey: T.Chat.ConversationIDKey,
  initialMessageID: T.Chat.MessageID,
  initialMessage?: T.Chat.MessageAttachment
) => {
  const [messageID, setMessageID] = React.useState(initialMessageID)
  const [messageOverride, setMessageOverride] = React.useState<T.Chat.MessageAttachment | undefined>(
    initialMessage
  )

  const loadedMessage = useConversationMessage(conversationIDKey, messageID)
  const initialMessageForID = initialMessage?.id === messageID ? initialMessage : undefined
  const overrideMessageForID = messageOverride?.id === messageID ? messageOverride : undefined
  const message: T.Chat.MessageAttachment =
    loadedMessage?.type === 'attachment'
      ? loadedMessage
      : (overrideMessageForID ?? initialMessageForID ?? blankMessage)
  const hasMessageID = !!T.Chat.messageIDToNumber(message.id)

  React.useEffect(() => {
    if (message !== blankMessage || !T.Chat.isValidConversationIDKey(conversationIDKey)) {
      return
    }
    logger.warn(
      `chat attachment fullscreen: missing attachment message for convID=${conversationIDKey} messageID=${messageID}`
    )
  }, [conversationIDKey, message, messageID])

  const onSwitchAttachment = (backInTime: boolean) => {
    const f = async () => {
      if (conversationIDKey !== blankMessage.conversationIDKey && message !== blankMessage && hasMessageID) {
        const nextMessage = await loadNextAttachmentMessage(conversationIDKey, message, backInTime)
        setMessageOverride(nextMessage)
        setMessageID(nextMessage.id)
      }
    }
    C.ignorePromise(f())
  }

  const onNextAttachment = () => {
    onSwitchAttachment(false)
  }
  const onPreviousAttachment = () => {
    onSwitchAttachment(true)
  }

  const navigateUp = C.Router2.navigateUp
  const {downloadPath, fileURL: path, fullHeight, fullWidth, fileType} = message
  const {previewHeight, previewURL: previewPath, previewWidth, title, transferProgress} = message
  const {height: clampedHeight, width: clampedWidth} = clampImageSize(
    previewWidth,
    previewHeight,
    maxWidth,
    maxHeight
  )

  const isPlayableMedia = message.fileType.startsWith('video') || message.fileType.startsWith('audio')
  const showPreview = !fileType.includes('png')
  const onAllMedia = () => showConversationInfoPanel(conversationIDKey, true, 'attachments')
  const onClose = () => navigateUp()
  const onDownloadAttachment = message.downloadPath || !hasMessageID
    ? undefined
    : () => {
        attachmentDownloadMessage(conversationIDKey, message)
      }

  const onShowInFinder = downloadPath
    ? () => openLocalPathInSystemFileManagerDesktop(downloadPath)
    : undefined

  const progress = transferProgress
  const progressLabel = downloadPath
    ? undefined
    : message.transferState === 'downloading'
      ? 'Downloading'
      : undefined

  return {
    fullHeight,
    fullWidth,
    hasMessageID,
    isPlayableMedia,
    message,
    onAllMedia,
    onClose,
    onDownloadAttachment,
    onNextAttachment: hasMessageID ? onNextAttachment : undefined,
    onPreviousAttachment: hasMessageID ? onPreviousAttachment : undefined,
    onShowInFinder,
    path,
    previewHeight: clampedHeight,
    previewPath,
    previewWidth: clampedWidth,
    progress,
    progressLabel,
    showPreview,
    title: message.decoratedText ? message.decoratedText.stringValue() : title,
  }
}

// if we've seen it its likely cached so lets just always just show it and never fallback
const seenPaths = new Set<string>()
// preload full and return ''. If too much time passes show preview. Show full when loaded
export const usePreviewFallback = (
  path: string,
  previewPath: string,
  isPlayableMedia: boolean,
  showPreview: boolean,
  preload: (path: string, onLoad: () => void, onError: () => void) => void
) => {
  const [imgSrc, setImgSrc] = React.useState('')
  const canUseFallback = path && previewPath && !isPlayableMedia && showPreview

  React.useEffect(() => {
    const onLoad = () => {
      clearTimeout(id)
      seenPaths.add(path)
      setImgSrc(path)
    }
    const onError = () => {
      clearTimeout(id)
      setImgSrc(previewPath)
    }

    preload(path, onLoad, onError)

    const id = setTimeout(() => {
      setImgSrc(previewPath)
    }, 300)

    return () => {
      clearTimeout(id)
    }
  }, [path, previewPath, isPlayableMedia, preload])

  if (seenPaths.has(path)) {
    return path
  }

  if (!canUseFallback) {
    return path || previewPath
  }

  return imgSrc
}
