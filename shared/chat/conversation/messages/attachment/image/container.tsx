import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as FsGen from '../../../../../actions/fs-gen'
import * as React from 'react'
import ImageAttachment from '.'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'
import {globalColors} from '../../../../../styles'
import {imgMaxWidth} from './image-render'

type OwnProps = {
  toggleMessageMenu: () => void
  isHighlighted?: boolean
}

const missingMessage = Constants.makeMessageAttachment()

const ImageAttachmentContainer = React.memo(function ImageAttachmentContainer(p: OwnProps) {
  const {isHighlighted, toggleMessageMenu} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  // TODO not message
  const data = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const message = m?.type === 'attachment' ? m : missingMessage
    const editInfo = Constants.getEditInfo(state, conversationIDKey)
    const {decoratedText, downloadPath, fileName, fileURL, inlineVideoPlayable} = message
    const {isCollapsed, previewHeight, previewURL, previewWidth} = message
    const {title, transferErrMsg, transferProgress, transferState, videoDuration} = message

    const downloadError = !!transferErrMsg

    return {
      decoratedText,
      downloadError,
      downloadPath,
      editInfo,
      fileName,
      fileURL,
      inlineVideoPlayable,
      isCollapsed,
      message,
      previewHeight,
      previewURL,
      previewWidth,
      title,
      transferProgress,
      transferState,
      videoDuration,
    }
  })

  const {decoratedText, downloadError, downloadPath, editInfo, message} = data
  const {fileName, fileURL, inlineVideoPlayable, isCollapsed, previewHeight, previewURL} = data
  const {previewWidth, title, transferProgress, transferState, videoDuration} = data

  const isEditing = !!(editInfo && editInfo.ordinal === ordinal)

  const dispatch = Container.useDispatch()

  const onClick = React.useCallback(() => {
    dispatch(Chat2Gen.createAttachmentPreviewSelect({conversationIDKey, ordinal}))
  }, [dispatch, conversationIDKey, ordinal])
  const onDoubleClick = onClick
  const onCollapse = React.useCallback(() => {
    dispatch(Chat2Gen.createToggleMessageCollapse({conversationIDKey, messageID: ordinal}))
  }, [dispatch, conversationIDKey, ordinal])
  const onRetry = React.useCallback(() => {
    dispatch(Chat2Gen.createAttachmentDownload({conversationIDKey, ordinal}))
  }, [dispatch, conversationIDKey, ordinal])
  const onShowInFinder = React.useCallback(
    (e: React.BaseSyntheticEvent) => {
      e.preventDefault()
      e.stopPropagation()
      downloadPath && dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: downloadPath}))
    },
    [dispatch, downloadPath]
  )

  const {height, width} = Constants.clampImageSize(previewWidth, previewHeight, Math.min(imgMaxWidth(), 320))
  // On mobile we use this icon to indicate we have the file stored locally, and it can be viewed. This is a
  // similar meaning to desktop.
  const arrowColor = !Container.isMobile
    ? message.downloadPath
      ? globalColors.green
      : message.transferState === 'downloading'
      ? globalColors.blue
      : ''
    : ''
  const buttonType = message.showPlayButton
  const hasProgress =
    !!message.transferState &&
    message.transferState !== 'remoteUploading' &&
    message.transferState !== 'mobileSaving'

  const props = {
    arrowColor,
    downloadError,
    fileName,
    fullPath: fileURL,
    hasProgress,
    height,
    inlineVideoPlayable,
    isCollapsed,
    isEditing,
    isHighlighted,
    message,
    onClick,
    onCollapse,
    onDoubleClick,
    onRetry,
    onShowInFinder: !Container.isMobile && downloadPath ? onShowInFinder : undefined,
    path: previewURL,
    progress: transferProgress,
    showButton: buttonType,
    title: decoratedText ? decoratedText.stringValue() : title,
    toggleMessageMenu,
    transferState,
    videoDuration: videoDuration ?? '',
    width,
  }
  return <ImageAttachment {...props} />
})

export default ImageAttachmentContainer
