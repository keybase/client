// @flow
import React from 'react'
import {Box, Icon, Text, PopupDialog, ProgressIndicator, NativeImage} from '../../../common-adapters/index.native'
import {MessagePopup} from '../messages/popup.native'
import {ImageIcon as AttachmentStatusIcon} from '../messages/attachment'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {formatTimeForPopup} from '../../../util/timestamp'

import type {Props} from './'

const AttachmentView = ({isZoomed, onToggleZoom, messageState, path}: {isZoomed: boolean, onToggleZoom: () => void, path: ?string}) => {
  if (path) {
    return <NativeImage resizeMode='contain' source={{uri: `file://${path}`}} style={{alignItems: 'center', flexGrow: 1, justifyContent: 'center'}} />
  } else {
    return (
      <Box style={styleContentsCenter}>
        <ProgressIndicator style={{width: 48}} white={true} />
      </Box>
    )
  }
}

const AttachmentPopup = ({message, detailsPopupShowing, isZoomed, onCloseDetailsPopup, onClose, onDownloadAttachment, onDeleteMessage, onOpenDetailsPopup, onToggleZoom, onOpenInFileUI, you}: Props) => {
  const {messageState, previewType, title, author, timestamp} = message
  let statusIcon
  if (messageState === 'downloading' || messageState === 'downloaded') {
    statusIcon = <AttachmentStatusIcon
      style={{position: 'absolute', bottom: -3, right: -3}}
      type={messageState === 'downloading' ? 'Downloading' : 'Downloaded'}
    />
  }

  if (!previewType || previewType === 'Other') {
    return (
      <PopupDialog onClose={onClose} fill={true} styleContainer={{
        ...globalStyles.flexBoxColumn,
        backgroundColor: globalColors.white,
        borderRadius: 0,
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 20,
      }}>
        <Text type='Body' onClick={onClose} style={{color: globalColors.blue, marginLeft: globalMargins.small, marginTop: globalMargins.small, borderBottomWidth: 1, borderBottomColor: globalColors.black_40}}>Close</Text>
        <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', alignItems: 'center', flex: 1}}>
          <Icon type='icon-file-48' />
          <Text type='BodySemibold' style={{marginTop: globalMargins.large, marginBottom: globalMargins.tiny}}>{title}</Text>
          <Text type='BodySmall'>Sent by {author}</Text>
          <Text type='BodySmall'>{formatTimeForPopup(timestamp)}</Text>
          <Text type='BodySmall' style={{color: globalColors.black, marginTop: globalMargins.large}}>Your device can not preview this file.</Text>
        </Box>
        <Box style={styleHeaderFooter}>
          <Icon type='iconfont-ellipsis' onClick={detailsPopupShowing ? onCloseDetailsPopup : onOpenDetailsPopup} />
        </Box>
        {statusIcon}
        {// $FlowIssue
          detailsPopupShowing && <MessagePopup
            you={you}
            message={message}
            onDeleteMessage={onDeleteMessage}
            onShowEditor={() => {}}
            onHidden={onCloseDetailsPopup}
            style={{position: 'absolute', right: globalMargins.xtiny, bottom: 28}}
          />}
      </PopupDialog>
    )
  }

  return (
    <PopupDialog onClose={onClose} fill={true} styleContainer={{
      backgroundColor: globalColors.black,
      borderRadius: 0,
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
      top: 20,
    }}>
      <Text type='Body' onClick={onClose} style={{color: globalColors.white, marginLeft: globalMargins.small, marginTop: globalMargins.small}}>Close</Text>
      <AttachmentView isZoomed={isZoomed} onToggleZoom={onToggleZoom} path={message.hdPreviewPath} />
      <Box style={styleHeaderFooter}>
        <Icon type='iconfont-ellipsis' style={{color: globalColors.white}} onClick={detailsPopupShowing ? onCloseDetailsPopup : onOpenDetailsPopup} />
      </Box>
      {statusIcon}
      {// $FlowIssue
        detailsPopupShowing && <MessagePopup
          you={you}
          message={message}
          onDeleteMessage={onDeleteMessage}
          onShowEditor={() => {}}
          onHidden={onCloseDetailsPopup}
          style={{position: 'absolute', right: globalMargins.xtiny, bottom: 28}}
        />}
    </PopupDialog>
  )
}

const styleHeaderFooter = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 32,
  marginLeft: globalMargins.small,
  marginBottom: globalMargins.small,
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

export default AttachmentPopup
