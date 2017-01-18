// @flow
import React from 'react'
import {Box, Icon, Text, PopupDialog, ProgressIndicator} from '../../../common-adapters/index'
import {AttachmentPopupMenu} from '../messages/popup'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {fileUIName} from '../../../constants/platform'

import type {Props} from './'
import type {Message} from '../../../constants/chat'

const AttachmentStatusFooter = ({message, onDownloadAttachment, onOpenInFileUI}: {message: Message, onDownloadAttachment: () => void, onOpenInFileUI: () => void}) => {
  let actionHandler
  let actionText
  if (message.downloadedPath) {
    actionHandler = onOpenInFileUI
    actionText = `Show in ${fileUIName}`
  } else {
    actionHandler = onDownloadAttachment
    actionText = 'Download'
  }

  return (
    <Box style={styleHeaderFooter}>
      <Text type='BodySmall' style={{color: globalColors.black_60, cursor: 'pointer'}} onClick={actionHandler}>{actionText}</Text>
    </Box>
  )
}

const AttachmentView = ({isZoomed, onToggleZoom, path}: {isZoomed: boolean, onToggleZoom: () => void, path: ?string}) => {
  if (path) {
    return (
      <Box style={isZoomed ? styleContentsZoom : styleContentsFit} onClick={onToggleZoom}>
        <img src={path} style={isZoomed ? styleImageZoom : styleImageFit} />
      </Box>
    )
  } else {
    return (
      <Box style={styleContentsCenter}>
        <ProgressIndicator style={{width: 48}} />
      </Box>
    )
  }
}

const AttachmentPopup = ({message, detailsPopupShowing, isZoomed, onCloseDetailsPopup, onClose, onDownloadAttachment, onDeleteMessage, onOpenDetailsPopup, onToggleZoom, onOpenInFileUI, you}: Props) => (
  <PopupDialog onClose={onClose} fill={true}>
    {detailsPopupShowing && <AttachmentPopupMenu
      you={you}
      message={message}
      onDeleteMessage={onDeleteMessage}
      onDownloadAttachment={onDownloadAttachment}
      onOpenInFileUI={onOpenInFileUI}
      onHidden={onCloseDetailsPopup}
      style={{position: 'absolute', top: 28, right: globalMargins.xtiny}}
    />}
    <Box style={styleHeaderFooter}>
      <Text type='BodySemibold' style={{color: globalColors.black_75, flex: 1}}>{message.title}</Text>
      <Icon type='iconfont-ellipsis' style={{color: globalColors.black_40, cursor: 'pointer'}} onClick={detailsPopupShowing ? onCloseDetailsPopup : onOpenDetailsPopup} />
    </Box>
    <AttachmentView isZoomed={isZoomed} onToggleZoom={onToggleZoom} path={message.downloadedPath} />
    <AttachmentStatusFooter message={message} onDownloadAttachment={onDownloadAttachment} onOpenInFileUI={onOpenInFileUI} />
  </PopupDialog>
)

const styleHeaderFooter = {
  ...globalStyles.flexBoxRow,
  height: 32,
  alignItems: 'center',
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  flexShrink: 0,
}

const styleContentsFit = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

const styleContentsCenter = {
  ...styleContentsFit,
  alignItems: 'center',
  justifyContent: 'center',
}

const styleContentsZoom = {
  display: 'block',
  overflow: 'auto',
  flex: 1,
}

const styleImageFit = {
  display: 'block',
  cursor: 'zoom-in',
  objectFit: 'scale-down',
  width: '100%',
}

const styleImageZoom = {
  display: 'block',
  cursor: 'zoom-out',
  minWidth: '100%',
  minHeight: '100%',
}

export default AttachmentPopup
