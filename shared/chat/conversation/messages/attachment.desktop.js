// @flow
import * as Constants from '../../../constants/chat'
import MessageComponent from './shared.desktop'
import React, {PureComponent} from 'react'
import {Box, Icon, Text} from '../../../common-adapters'
import {fileUIName} from '../../../constants/platform'
import {globalStyles, globalMargins, globalColors} from '../../../styles'

import type {Props, ProgressBarProps, ImageIconProps} from './attachment'

function AttachmentTitle ({messageState, title}: {messageState: Constants.AttachmentMessageState, title: string}) {
  let style = {}
  switch (messageState) {
    case 'uploading':
    case 'pending':
    case 'failed':
      style = {color: globalColors.black_40}
      break
  }
  return <Text type='BodySemibold' style={style}>{title}</Text>
}

function PreviewImage ({message: {previewPath, previewType, previewSize, messageState}, onOpenInPopup}: {message: Constants.AttachmentMessage, onOpenInPopup: () => void}) {
  if (!!previewPath && previewType === 'Image') {
    let style = {
      ...globalStyles.flexBoxRow,
      marginTop: globalMargins.xtiny,
      flex: 1,
      position: 'relative',
      alignItems: 'flex-end',
    }
    const imgStyle = {...globalStyles.rounded, ...(previewSize ? {width: previewSize.width, height: previewSize.height} : {maxHeight: 320, maxWidth: 320})}

    switch (messageState) {
      case 'uploading':
      case 'pending':
      case 'failed':
        style = {...style, opacity: 0.4}
        break
    }

    return (
      <Box style={style} onClick={onOpenInPopup}>
        <img style={imgStyle} src={previewPath} />
        {(messageState === 'downloading' || messageState === 'downloaded') &&
          <ImageIcon
            style={{position: 'relative', right: 19, top: 3}}
            type={messageState === 'downloading' ? 'Downloading' : 'Downloaded'} />}
      </Box>
    )
  }

  return null
}

function ProgressBar ({text, progress, style}: ProgressBarProps) {
  const basicStyle = {height: 4, width: 64, borderRadius: 4}
  const containerStyle = {
    ...globalStyles.flexBoxRow,
    ...globalStyles.rounded,
    borderTopLeftRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: 'center',
    backgroundColor: globalColors.white,
    ...style,
  }

  return (
    <Box style={containerStyle}>
      <Text type={'BodySmall'} style={{marginRight: globalMargins.xtiny}}>{text}</Text>
      <Box style={{...basicStyle, marginTop: 2, marginLeft: globalMargins.xtiny, backgroundColor: globalColors.black_05}}>
        <Box style={{...basicStyle, width: 64 * progress, backgroundColor: globalColors.blue}} />
      </Box>
    </Box>
  )
}

function ImageIcon ({type, style}: ImageIconProps) {
  const iconStyle = {
    color: type === 'Downloading' ? globalColors.blue : globalColors.green,
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
      <Icon type='iconfont-import' style={iconStyle} />
    </Box>
  )
}

function PreviewImageWithInfo ({message, onOpenInFileUI, onOpenInPopup}: {message: Constants.AttachmentMessage, onOpenInFileUI: (path: string) => void, onOpenInPopup: () => void}) {
  const {downloadedPath, messageState} = message

  const progressBarStyle = {
    ...(messageState === 'uploading' ? {position: 'absolute', bottom: 0, left: 0} : {}),
  }

  return (
    <Box style={{position: 'relative'}}>
      <PreviewImage message={message} onOpenInPopup={onOpenInPopup} />
      <Box style={{marginTop: globalMargins.xtiny}}>
        {!!message.progress &&
          (messageState === 'uploading' || messageState === 'downloading') &&
          <ProgressBar
            style={progressBarStyle}
            text={messageState === 'downloading' ? 'Downloading' : 'Uploading'}
            progress={message.progress} />}
        {!!downloadedPath &&
          <Text type='BodySmallSecondaryLink' onClick={() => onOpenInFileUI(downloadedPath)}>
            Show in {fileUIName}
          </Text>}
      </Box>
    </Box>
  )
}

function AttachmentIcon ({messageState}: {messageState: Constants.AttachmentMessageState}) {
  let iconType = 'icon-file-24'
  let style = {}
  switch (messageState) {
    case 'downloading':
      iconType = 'icon-file-downloading-24'
      break
    case 'downloaded':
      iconType = 'icon-file-downloaded-24'
      break
    case 'uploading':
    case 'pending':
    case 'failed':
      style = {...style, opacity: 0.4}
  }
  return <Icon type={iconType} style={style} />
}

function AttachmentMessageGeneric ({message, onOpenInFileUI}: {message: Constants.AttachmentMessage, onOpenInFileUI: () => void}) {
  const {downloadedPath, messageState} = message
  return (
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', marginTop: globalMargins.tiny}}>
      <Box>
        <AttachmentIcon messageState={messageState} />
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: globalMargins.xtiny}}>
        <AttachmentTitle {...message} />
        {!!message.progress &&
          (messageState === 'uploading' || messageState === 'downloading') &&
          <ProgressBar
            text={messageState === 'downloading' ? 'Downloading' : 'Uploading'}
            progress={message.progress} />}
        {!!downloadedPath &&
          <Text type='BodySmallSecondaryLink' onClick={() => onOpenInFileUI()}>
            Show in {fileUIName}
          </Text>}
      </Box>
    </Box>
  )
}

function AttachmentMessagePreviewImage ({message, onOpenInFileUI, onOpenInPopup}: {message: Constants.AttachmentMessage, onOpenInFileUI: () => void, onOpenInPopup: () => void}) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, ...globalStyles.clickable, flex: 1}}>
      <AttachmentTitle {...message} />
      <PreviewImageWithInfo message={message} onOpenInFileUI={onOpenInFileUI} onOpenInPopup={onOpenInPopup} />
    </Box>
  )
}

export default class AttachmentMessage extends PureComponent<void, Props, void> {
  _onOpenInPopup = () => {
    this.props.onOpenInPopup(this.props.message)
  }

  _onOpenInFileUI = () => {
    const {downloadedPath} = this.props.message
    downloadedPath && this.props.onOpenInFileUI(downloadedPath)
  }

  render () {
    const {message} = this.props

    let attachment
    switch (message.previewType) {
      case 'Image':
        attachment = <AttachmentMessagePreviewImage message={message} onOpenInPopup={this._onOpenInPopup} onOpenInFileUI={this._onOpenInFileUI} />
        break
      default:
        attachment = <AttachmentMessageGeneric message={message} onOpenInFileUI={this._onOpenInFileUI} />
    }

    return (
      <MessageComponent {...this.props}>
        {attachment}
      </MessageComponent>
    )
  }
}

export {
  ProgressBar,
  ImageIcon,
}
