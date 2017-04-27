// @flow
import React from 'react'
import {Box, Icon, Text, ProgressIndicator, NativeImage} from '../../../common-adapters/index.native'
import {ImageIcon as AttachmentStatusIcon} from '../messages/attachment'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {formatTimeForPopup} from '../../../util/timestamp'

import type {Props} from './'

const AttachmentView = ({isZoomed, onToggleZoom, messageState, path, previewSize}: {isZoomed: boolean, onToggleZoom: () => void, path: ?string, previewSize: ?{width: number, height: number}}) => (
  <Box style={{...globalStyles.flexBoxCenter, flex: 1}}>
    {!!path && <NativeImage resizeMode='contain' source={{uri: `file://${path}`}} style={{alignItems: 'center', flexGrow: 1, justifyContent: 'center', width: previewSize ? previewSize.width : 100, height: previewSize ? previewSize.height : 100}} />}
    {!path && <ProgressIndicator style={{width: 48}} white={true} />}
  </Box>
)

const AttachmentPopup = ({message, isZoomed, onClose, onDownloadAttachment, onDeleteMessage, onMessageAction, onToggleZoom, onOpenInFileUI, you}: Props) => {
  const {messageState, previewType, title, author, timestamp, previewSize} = message
  let statusIcon
  if (messageState === 'downloading' || messageState === 'downloaded') {
    statusIcon = <AttachmentStatusIcon
      style={{position: 'absolute', bottom: -3, right: -3}}
      type={messageState === 'downloading' ? 'Downloading' : 'Downloaded'}
    />
  }

  if (!previewType || previewType === 'Other') {
    return (
      <Box style={{
        ...globalStyles.flexBoxColumn,
        ...globalStyles.fillAbsolute,
        backgroundColor: globalColors.white,
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
          <Icon type='iconfont-ellipsis' onClick={onMessageAction} />
        </Box>
        {statusIcon}
      </Box>
    )
  }

  return (
    <Box style={{
      ...globalStyles.flexBoxColumn,
      ...globalStyles.fillAbsolute,
      backgroundColor: globalColors.black,
    }}>
      <Text type='Body' onClick={onClose} style={{color: globalColors.white, marginLeft: globalMargins.small, marginTop: globalMargins.small}}>Close</Text>
      <AttachmentView isZoomed={isZoomed} onToggleZoom={onToggleZoom} path={message.hdPreviewPath} previewSize={previewSize} />
      <Box style={styleHeaderFooter}>
        <Icon type='iconfont-ellipsis' style={{color: globalColors.white}} onClick={onMessageAction} />
      </Box>
      {statusIcon}
    </Box>
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

export default AttachmentPopup
