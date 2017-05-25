// @flow
import React from 'react'
import {Box, Icon, Text, PopupDialog, ProgressIndicator} from '../../../common-adapters/index'
import {AttachmentPopupMenu} from '../messages/popup'
import {ProgressBar as AttachmentProgressBar, ImageIcon as AttachmentStatusIcon} from '../messages/attachment'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {fileUIName} from '../../../constants/platform'

import type {Props} from './'
import type {AttachmentMessage} from '../../../constants/chat'

const AttachmentStatusFooter = ({
  message,
  onDownloadAttachment,
  onOpenInFileUI,
}: {
  message: AttachmentMessage,
  onDownloadAttachment: () => void,
  onOpenInFileUI: () => void,
}) => {
  const {downloadProgress, savedPath} = message

  let contents
  if (savedPath === false && downloadProgress !== null) {
    contents = <AttachmentProgressBar text="Downloading" progress={downloadProgress} />
  } else if (savedPath) {
    contents = (
      <Text
        type="BodySmall"
        style={{color: globalColors.black_60, cursor: 'pointer'}}
        onClick={onOpenInFileUI}
      >
        Show in {fileUIName}
      </Text>
    )
  } else {
    contents = (
      <Text
        type="BodySmall"
        style={{color: globalColors.black_60, cursor: 'pointer'}}
        onClick={onDownloadAttachment}
      >
        Download
      </Text>
    )
  }

  return (
    <Box style={styleHeaderFooter}>
      {contents}
    </Box>
  )
}

const AttachmentView = ({
  isZoomed,
  onToggleZoom,
  messageState,
  path,
}: {
  isZoomed: boolean,
  onToggleZoom: () => void,
  path: ?string,
}) => {
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

const AttachmentPopup = ({
  message,
  detailsPopupShowing,
  isZoomed,
  onCloseDetailsPopup,
  onClose,
  onDownloadAttachment,
  onDeleteMessage,
  onOpenDetailsPopup,
  onToggleZoom,
  onOpenInFileUI,
  you,
}: Props) => {
  const {savedPath, downloadProgress, downloadedPath} = message
  let statusIcon
  if (savedPath || (savedPath === false && downloadProgress !== null)) {
    statusIcon = (
      <AttachmentStatusIcon
        style={{position: 'absolute', bottom: -3, right: -3}}
        type={savedPath ? 'Downloaded' : 'Downloading'}
      />
    )
  }

  return (
    <PopupDialog onClose={onClose} fill={true}>
      {detailsPopupShowing &&
        <AttachmentPopupMenu
          you={you}
          message={message}
          onDeleteMessage={onDeleteMessage}
          onDownloadAttachment={onDownloadAttachment}
          onOpenInFileUI={onOpenInFileUI}
          onHidden={onCloseDetailsPopup}
          style={{position: 'absolute', top: 28, right: globalMargins.xtiny}}
        />}
      <Box style={styleHeaderFooter}>
        <Text type="BodySemibold" style={{color: globalColors.black_75, flex: 1}}>{message.title}</Text>
        <Icon
          type="iconfont-ellipsis"
          style={{color: globalColors.black_40, cursor: 'pointer'}}
          onClick={detailsPopupShowing ? onCloseDetailsPopup : onOpenDetailsPopup}
        />
      </Box>
      <AttachmentView isZoomed={isZoomed} onToggleZoom={onToggleZoom} path={downloadedPath} />
      <AttachmentStatusFooter
        message={message}
        onDownloadAttachment={onDownloadAttachment}
        onOpenInFileUI={onOpenInFileUI}
      />
      {statusIcon}
    </PopupDialog>
  )
}

const styleHeaderFooter = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 32,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
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
  flex: 1,
  overflow: 'auto',
}

const styleImageFit = {
  cursor: 'zoom-in',
  display: 'block',
  objectFit: 'scale-down',
  width: '100%',
}

const styleImageZoom = {
  cursor: 'zoom-out',
  display: 'block',
  minHeight: '100%',
  minWidth: '100%',
}

export default AttachmentPopup
