// @flow
import * as Constants from '../../../constants/chat'
import MessageComponent from './shared.desktop'
import React, {PureComponent} from 'react'
import {Box, Icon, ProgressIndicator, Text} from '../../../common-adapters'
import {fileUIName} from '../../../constants/platform'
import {globalStyles, globalMargins, globalColors} from '../../../styles'

import type {Props, ProgressBarProps, ImageIconProps} from './attachment'

function _showProgressBar (messageState, progress) {
  return !!progress && (messageState === 'uploading' || messageState === 'downloading')
}

function _showPreviewProgress (messageState, progress) {
  return !!progress && (messageState === 'downloading-preview')
}

function AttachmentTitle ({messageState, title}: {messageState: Constants.AttachmentMessageState, title: ?string}) {
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

function PreviewImage ({message: {previewPath, previewType, previewSize, messageState}, onOpenInPopup}: {message: Constants.AttachmentMessage, onOpenInPopup: ?() => void}) {
  if (previewType === 'Image') {
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

function ShowInFileUi ({downloadedPath, onOpenInFileUI}) {
  return <Text type='BodySmallSecondaryLink' onClick={() => onOpenInFileUI(downloadedPath)}>
    Show in {fileUIName}
  </Text>
}

function PreviewImageWithInfo ({message, onOpenInFileUI, onOpenInPopup}: {message: Constants.AttachmentMessage, onOpenInFileUI: (path: string) => void, onOpenInPopup: ?() => void}) {
  const {downloadedPath, messageState} = message

  const overlayProgressBarStyle = {
    position: 'absolute',
    bottom: globalMargins.xtiny,
    left: 0,
    paddingLeft: globalMargins.xtiny,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
    paddingBottom: globalMargins.xtiny,
  }

  const previewProgressIndicatorStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 32,
    marginLeft: -16,
    marginTop: -16,
  }

  return (
    <Box style={{...globalStyles.flexBoxColumn, position: 'relative'}}>
      <Box style={{display: 'inline-flex', alignSelf: 'flex-start', position: 'relative'}}>
        <PreviewImage message={message} onOpenInPopup={onOpenInPopup} />
        {_showPreviewProgress(messageState, message.progress) && !!message.progress &&
          <ProgressIndicator
            style={previewProgressIndicatorStyle}
          />}
      </Box>
      <Box style={{marginTop: globalMargins.xtiny}}>
        {_showProgressBar(messageState, message.progress) && !!message.progress &&
          <ProgressBar
            style={messageState === 'uploading' ? overlayProgressBarStyle : {}}
            text={messageState === 'downloading' ? 'Downloading' : 'Encrypting'}
            progress={message.progress} />}
        {downloadedPath && <ShowInFileUi downloadedPath={downloadedPath} onOpenInFileUI={onOpenInFileUI} />}
      </Box>
    </Box>
  )
}

function AttachmentIcon ({messageState}: {messageState: Constants.AttachmentMessageState}) {
  let iconType = 'icon-file-24'
  let style = {marginTop: 8, marginBottom: 8, height: 24}
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

function AttachmentMessageGeneric ({message, onOpenInFileUI, onLoadAttachment}: {message: Constants.AttachmentMessage, onOpenInFileUI: () => void, onLoadAttachment: () => void}) {
  const {downloadedPath, messageState, progress} = message
  return (
    <Box style={{...globalStyles.flexBoxRow, ...(!message.downloadedPath ? globalStyles.clickable : {}), alignItems: 'center'}} onClick={!message.downloadedPath ? onLoadAttachment : undefined}>
      <AttachmentIcon messageState={messageState} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: globalMargins.xtiny}}>
        <AttachmentTitle {...message} />

        {(_showProgressBar(messageState, progress) || downloadedPath) &&
          <Box style={{height: 14}}>
            {_showProgressBar(messageState, progress) && !!progress &&
              <ProgressBar
                text={messageState === 'downloading' ? 'Downloading' : 'Encrypting'}
                progress={progress} />}
            {downloadedPath && <ShowInFileUi downloadedPath={downloadedPath} onOpenInFileUI={onOpenInFileUI} />}
          </Box>}
      </Box>
    </Box>
  )
}

function AttachmentMessagePreviewImage ({message, onOpenInFileUI, onOpenInPopup}: {message: Constants.AttachmentMessage, onOpenInFileUI: () => void, onOpenInPopup: () => void}) {
  const canOpen = message.messageState !== 'uploading'
  return (
    <Box style={{...globalStyles.flexBoxColumn, ...(canOpen ? globalStyles.clickable : {}), flex: 1}}>
      <AttachmentTitle {...message} />
      <PreviewImageWithInfo message={message} onOpenInFileUI={onOpenInFileUI} onOpenInPopup={canOpen ? onOpenInPopup : null} />
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

  _onLoadAttachment = () => {
    const {messageID, filename} = this.props.message
    messageID && filename && this.props.onLoadAttachment(messageID, filename)
  }

  render () {
    const {message} = this.props

    let attachment
    switch (message.previewType) {
      case 'Image':
        attachment = <AttachmentMessagePreviewImage message={message} onOpenInPopup={this._onOpenInPopup} onOpenInFileUI={this._onOpenInFileUI} />
        break
      default:
        attachment = <AttachmentMessageGeneric message={message} onOpenInFileUI={this._onOpenInFileUI} onLoadAttachment={this._onLoadAttachment} />
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
