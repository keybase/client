import * as React from 'react'
import * as C from '@/constants'
import {clampImageSize} from '@/constants/chat/helpers'
import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import logger from '@/logger'
import {maxWidth, maxHeight} from '../messages/attachment/shared'
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'
import {
  attachmentDownloadMessage,
  loadNextAttachmentMessage,
} from '../attachment-actions'
import {showConversationInfoPanel} from '../thread-context'
import {useConversationMessageByOrdinal} from '../data-hooks'

const blankMessage = Chat.makeMessageAttachment({})
export const useData = (
  conversationIDKey: T.Chat.ConversationIDKey,
  initialOrdinal: T.Chat.Ordinal,
  initialMessage?: T.Chat.MessageAttachment
) => {
  const [ordinal, setOrdinal] = React.useState(initialOrdinal)
  const [messageOverride, setMessageOverride] = React.useState<T.Chat.MessageAttachment | undefined>(
    initialMessage
  )

  const loadedMessage = useConversationMessageByOrdinal(conversationIDKey, ordinal)
  const initialMessageForOrdinal = initialMessage?.ordinal === ordinal ? initialMessage : undefined
  const overrideMessageForOrdinal = messageOverride?.ordinal === ordinal ? messageOverride : undefined
  const message: T.Chat.MessageAttachment =
    loadedMessage?.type === 'attachment'
      ? loadedMessage
      : (overrideMessageForOrdinal ?? initialMessageForOrdinal ?? blankMessage)

  React.useEffect(() => {
    if (message !== blankMessage || !T.Chat.isValidConversationIDKey(conversationIDKey)) {
      return
    }
    const ordinalNumber = T.Chat.ordinalToNumber(ordinal)
    logger.warn(
      `chat attachment fullscreen: missing attachment message for convID=${conversationIDKey} ordinal=${ordinalNumber}`
    )
  }, [conversationIDKey, message, ordinal])

  const onSwitchAttachment = (backInTime: boolean) => {
    const f = async () => {
      if (conversationIDKey !== blankMessage.conversationIDKey && message !== blankMessage) {
        const nextMessage = await loadNextAttachmentMessage(conversationIDKey, message, backInTime)
        setMessageOverride(nextMessage)
        setOrdinal(nextMessage.ordinal)
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

  const isVideo = message.fileType.startsWith('video')
  const showPreview = !fileType.includes('png')
  const onAllMedia = () => showConversationInfoPanel(conversationIDKey, true, 'attachments')
  const onClose = () => navigateUp()
  const onDownloadAttachment = message.downloadPath
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
    isVideo,
    message,
    onAllMedia,
    onClose,
    onDownloadAttachment,
    onNextAttachment,
    onPreviousAttachment,
    onShowInFinder,
    ordinal,
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
  isVideo: boolean,
  showPreview: boolean,
  preload: (path: string, onLoad: () => void, onError: () => void) => void
) => {
  const [imgSrc, setImgSrc] = React.useState('')
  const canUseFallback = path && previewPath && !isVideo && showPreview

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
  }, [path, previewPath, isVideo, preload])

  if (seenPaths.has(path)) {
    return path
  }

  if (!canUseFallback) {
    return path || previewPath
  }

  return imgSrc
}
