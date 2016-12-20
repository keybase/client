// @flow
import React, {PureComponent} from 'react'
import * as Constants from '../../../constants/chat'
import {Box, Icon, Text} from '../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import MessageComponent from './shared.desktop'
import {fileUIName} from '../../../constants/platform'

import type {Props} from './attachment'

function AttachmentTitle ({messageState, title}: {messageState: Constants.AttachmentMessageState, title: string}) {
  let style = {}
  switch (messageState) {
    case 'uploading':
    case 'pending':
    case 'failed':
      style = {color: globalColors.black_75}
      break
  }
  return <Text type='BodySemibold' style={style}>{title}</Text>
}

function PreviewImage ({message: {previewPath, previewType, messageState}}: {message: Constants.AttachmentMessage}) {
  if (!!previewPath && previewType === 'Image') {
    let style = {
      ...globalStyles.flexBoxRow,
      marginTop: globalMargins.xtiny,
      flex: 1,
      position: 'relative',
      alignItems: 'flex-end',
    }
    switch (messageState) {
      case 'uploading':
      case 'pending':
      case 'failed':
        style = {...style, opacity: 0.4}
        break
    }

    return (
      <Box style={style}>
        <img style={{...globalStyles.rounded}} src={previewPath} />
        {(messageState === 'downloading' || messageState === 'downloaded') &&
          <ImageIcon
            style={{position: 'relative', right: 19, top: 3}}
            type={messageState === 'downloading' ? 'Downloading' : 'Downloaded'} />}
      </Box>
    )
  }

  return null
}

function ProgressBar ({text, progress, style}, {text: string, progress: number, style: Object}) {
  const basicStyle = {height: 4, width: 64, borderRadius: 4}
  const containerStyle = {
    ...globalStyles.flexBoxRow,
    ...globalStyles.rounded,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: 'center',
    backgroundColor: globalColors.white,
    paddingTop: globalMargins.tiny,
    paddingBottom: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
    paddingLeft: globalMargins.xtiny,
    ...style,
  }

  return (
    <Box style={containerStyle}>
      <Text type={'BodySmall'}>{text}</Text>
      <Box style={{...basicStyle, marginTop: 2, marginLeft: globalMargins.xtiny, backgroundColor: globalColors.black_05}}>
        <Box style={{...basicStyle, width: Math.ceil(64 * progress), backgroundColor: globalColors.blue}} />
      </Box>
    </Box>
  )
}

function ImageIcon ({type, style}: {type: 'Downloaded' | 'Downloading', style: Object}) {
  let iconStyle = {
    color: globalColors.blue,
    lineHeight: 0,
    top: 2,
  }

  const wrapperStyle = {
    backgroundColor: globalColors.white,
    borderRadius: '100%',
    padding: 3,
  }

  return (
    <Box style={{...wrapperStyle, ...style}}>
      <Icon type={'iconfont-import'} style={iconStyle} />
    </Box>
  )
      // {(type === 'Downloaded') ? <div>'download-icon'</div> : <div>'downloading-icon'</div>}
}

function PreviewImageWithInfo ({message, isDownloading, onOpenInFileUI}: {message: Constants.AttachmentMessage, isDownloading: boolean, onOpenInFileUI: (path: string) => void}) {
  const {downloadedPath} = message

  return (
    <Box style={{position: 'relative'}}>
      <PreviewImage message={message} />
      <Box style={{marginTop: globalMargins.xtiny}}>
        {!!message.progress &&
          <ProgressBar
            style={isDownloading ? {} : {position: 'absolute', bottom: 0, left: 0}}
            text={message.messageState === 'downloading' ? 'Downloading' : 'Uploading'}
            progress={message.progress} />}
        {!!downloadedPath &&
          <Text type='BodySmallSecondaryLink' onClick={() => onOpenInFileUI(downloadedPath)}>
            Show in {fileUIName}
          </Text>}
      </Box>
    </Box>
  )
}

// TODO abstract this part so it is the same as message text
class _AttachmentMessage extends PureComponent<void, Props, void> {
  render () {
    const {message, onLoadAttachment, onOpenInFileUI} = this.props
    const isDownloading = message.messageState === 'downloading'

    return (
      <MessageComponent {...this.props}>
        <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
          <AttachmentTitle {...message} />
          {!message.downloadedPath &&
            <Text type='Body' style={{marginTop: globalMargins.xtiny, flex: 1}} onClick={() => onLoadAttachment(message.messageID, message.filename)}>
              Click to download: {message.title} - {message.filename}
            </Text>}
          <PreviewImageWithInfo message={message} isDownloading={isDownloading} onOpenInFileUI={onOpenInFileUI} />
        </Box>
      </MessageComponent>
    )
  }
}

const stylesFirstNewMessage = {
  borderTop: `solid 1px ${globalColors.orange}`,
}
