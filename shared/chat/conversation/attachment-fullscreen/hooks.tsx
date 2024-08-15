import * as React from 'react'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import {maxWidth, maxHeight} from '../messages/attachment/shared'

const blankMessage = C.Chat.makeMessageAttachment({})
export const useData = (initialOrdinal: T.Chat.Ordinal) => {
  const conversationIDKey = C.useChatContext(s => s.id)
  const [ordinal, setOrdinal] = React.useState(initialOrdinal)

  const message: T.Chat.MessageAttachment = C.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    return m?.type === 'attachment' ? m : blankMessage
  })

  const loadNextAttachment = C.useChatContext(s => s.dispatch.loadNextAttachment)
  const onSwitchAttachment = React.useCallback(
    (backInTime: boolean) => {
      const f = async () => {
        if (conversationIDKey !== blankMessage.conversationIDKey) {
          const o = await loadNextAttachment(ordinal, backInTime)
          setOrdinal(o)
        }
      }
      C.ignorePromise(f())
    },
    [conversationIDKey, loadNextAttachment, ordinal]
  )

  const onNextAttachment = React.useCallback(() => {
    onSwitchAttachment(false)
  }, [onSwitchAttachment])
  const onPreviousAttachment = React.useCallback(() => {
    onSwitchAttachment(true)
  }, [onSwitchAttachment])

  const openLocalPathInSystemFileManagerDesktop = C.useFSState(
    s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop
  )
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const attachmentDownload = C.useChatContext(s => s.dispatch.attachmentDownload)
  const {downloadPath, fileURL: path, fullHeight, fullWidth, fileType} = message
  const {previewHeight, previewURL: previewPath, previewWidth, title, transferProgress} = message
  const {height: clampedHeight, width: clampedWidth} = C.Chat.clampImageSize(
    previewWidth,
    previewHeight,
    maxWidth,
    maxHeight
  )
  const isVideo = C.Chat.isVideoAttachment(message)
  const showPreview = !fileType.includes('png')
  const onAllMedia = () => showInfoPanel(true, 'attachments')
  const onClose = () => navigateUp()
  const onDownloadAttachment = message.downloadPath
    ? undefined
    : () => {
        attachmentDownload(message.ordinal)
      }

  const onShowInFinder = downloadPath
    ? () => openLocalPathInSystemFileManagerDesktop?.(downloadPath)
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
