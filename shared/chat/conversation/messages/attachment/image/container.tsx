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
  const message = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    return m?.type === 'attachment' ? m : missingMessage
  })
  const editInfo = Container.useSelector(state =>
    Constants.getEditInfo(state, message?.conversationIDKey ?? '')
  )
  const isEditing = !!(editInfo && editInfo.ordinal === message.ordinal)

  const dispatch = Container.useDispatch()

  const onClick = React.useCallback(() => {
    dispatch(Chat2Gen.createAttachmentPreviewSelect({message}))
  }, [dispatch, message])
  const onCollapse = React.useCallback(() => {
    dispatch(
      Chat2Gen.createToggleMessageCollapse({
        collapse: !message.isCollapsed,
        conversationIDKey: message.conversationIDKey,
        messageID: message.id,
      })
    )
  }, [dispatch, message])
  const onDoubleClick = React.useCallback(() => {
    dispatch(Chat2Gen.createAttachmentPreviewSelect({message}))
  }, [dispatch, message])
  const onRetry = React.useCallback(() => {
    dispatch(Chat2Gen.createAttachmentDownload({message}))
  }, [dispatch, message])
  const onShowInFinder = React.useCallback(
    (e: React.BaseSyntheticEvent) => {
      e.preventDefault()
      e.stopPropagation()
      message.downloadPath &&
        dispatch(FsGen.createOpenLocalPathInSystemFileManager({localPath: message.downloadPath}))
    },
    [dispatch, message]
  )

  const {height, width} = Constants.clampImageSize(
    message.previewWidth,
    message.previewHeight,
    Math.min(imgMaxWidth(), 320)
  )
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
    downloadError: !!message.transferErrMsg,
    fileName: message.fileName,
    fullPath: message.fileURL,
    hasProgress,
    height,
    inlineVideoPlayable: message.inlineVideoPlayable,
    isCollapsed: message.isCollapsed,
    isEditing,
    isHighlighted,
    message,
    onClick,
    onCollapse,
    onDoubleClick,
    onRetry,
    onShowInFinder: !Container.isMobile && message.downloadPath ? onShowInFinder : undefined,
    path: message.previewURL,
    progress: message.transferProgress,
    showButton: buttonType,
    title: message.decoratedText ? message.decoratedText.stringValue() : message.title,
    toggleMessageMenu,
    transferState: message.transferState,
    videoDuration: message.videoDuration || '',
    width,
  }
  return <ImageAttachment {...props} />
})

export default ImageAttachmentContainer
