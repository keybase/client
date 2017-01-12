// @flow
import React from 'react'
import {Box, Icon, Text, PopupDialog} from '../../../common-adapters/index'
import {AttachmentPopupMenu} from '../messages/popup'
import {globalColors, globalMargins, globalStyles} from '../../../styles'

import type {Props} from './'

const AttachmentPopup = ({message, detailsPopupShowing, isZoomed, onCloseDetailsPopup, onClose, onDownload, onDeleteMessage, onOpenDetailsPopup, onToggleZoom, onOpenInFileUI, you}: Props) => (
  <PopupDialog onClose={onClose} fill={true}>
    {detailsPopupShowing && <AttachmentPopupMenu
      you={you}
      message={message}
      onDeleteMessage={onDeleteMessage}
      onDownloadAttachment={onDownload}
      onOpenInFileUI={onOpenInFileUI}
      onHidden={onCloseDetailsPopup}
      style={{position: 'absolute', top: 28, right: globalMargins.xtiny}}
    />}
    <Box style={styleHeaderFooter}>
      <Text type='BodySemibold' style={{color: globalColors.black_75, flex: 1}}>{message.title}</Text>
      <Icon type='iconfont-ellipsis' style={{color: globalColors.black_40, cursor: 'pointer'}} onClick={detailsPopupShowing ? onCloseDetailsPopup : onOpenDetailsPopup} />
    </Box>
    <Box style={isZoomed ? styleContentsZoom : styleContentsFit} onClick={onToggleZoom}>
      <img src={message.downloadedPath} style={isZoomed ? styleImageZoom : styleImageFit} />
    </Box>
    <Box style={styleHeaderFooter}>
      <Text type='BodySmall' style={{color: globalColors.black_60, cursor: 'pointer'}} onClick={onDownload}>Download</Text>
    </Box>
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
