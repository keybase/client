import * as React from 'react'
import * as C from '@/constants'
import {clampImageSize} from '@/constants/chat/helpers'
import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import logger from '@/logger'
import {maxWidth, maxHeight} from '../messages/attachment/shared'
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'
import {
  useConversationShowInfoPanel,
  useConversationThreadID,
  useConversationThreadMessage,
} from '../thread-context'
import {useConversationAttachmentActions} from '../attachment-actions'

const blankMessage = Chat.makeMessageAttachment({})
export const useData = (initialOrdinal: T.Chat.Ordinal, initialMessage?: T.Chat.MessageAttachment) => {
  const conversationIDKey = useConversationThreadID()
  const [ordinal, setOrdinal] = React.useState(initialOrdinal)

  const threadMessage = useConversationThreadMessage(ordinal)
  const initialMessageForOrdinal = initialMessage?.ordinal === ordinal ? initialMessage : undefined
  const message: T.Chat.MessageAttachment =
    threadMessage?.type === 'attachment' ? threadMessage : (initialMessageForOrdinal ?? blankMessage)

  React.useEffect(() => {
    if (message !== blankMessage || !T.Chat.isValidConversationIDKey(conversationIDKey)) {
      return
    }
    const ordinalNumber = T.Chat.ordinalToNumber(ordinal)
    logger.warn(
      `chat attachment fullscreen: missing attachment message for convID=${conversationIDKey} ordinal=${ordinalNumber}`
    )
  }, [conversationIDKey, message, ordinal])

  const {attachmentDownload, loadNextAttachment} = useConversationAttachmentActions()
  const onSwitchAttachment = (backInTime: boolean) => {
    const f = async () => {
      if (conversationIDKey !== blankMessage.conversationIDKey) {
        const o = await loadNextAttachment(ordinal, backInTime)
        setOrdinal(o)
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
  const showInfoPanel = useConversationShowInfoPanel()
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
  const onAllMedia = () => showInfoPanel(true, 'attachments')
  const onClose = () => navigateUp()
  const onDownloadAttachment = message.downloadPath
    ? undefined
    : () => {
        attachmentDownload(message.ordinal)
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
