// @flow
import * as Constants from '../../../constants/chat'
import MessageWrapper from './wrapper'
import moment from 'moment'
import React, {PureComponent} from 'react'
import {Box, Icon, ProgressIndicator, Text} from '../../../common-adapters'
import {isMobile, fileUIName} from '../../../constants/platform'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {ImageRender} from './attachment.render'

import type {Props, ProgressBarProps, ImageIconProps} from './attachment'

function _showProgressBar (messageState, progress) {
  return !!progress && (messageState === 'uploading' || (!isMobile && messageState === 'downloading'))
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

function PreviewImage ({message: {attachmentDurationMs, previewDurationMs, previewPath, previewType, previewSize, messageState}, onOpenInPopup}: {message: Constants.AttachmentMessage, onOpenInPopup: ?() => void}) {
  if (previewType === 'Image' || previewType === 'Video') {
    let style = {
      ...globalStyles.flexBoxRow,
      marginTop: globalMargins.xtiny,
      position: 'relative',
      alignItems: 'flex-end',
    }
    const imgStyle = {borderRadius: 4, ...(previewSize ? {width: previewSize.width, height: previewSize.height} : {maxHeight: 320, maxWidth: 320})}

    switch (messageState) {
      case 'uploading':
      case 'pending':
      case 'failed':
        style = {...style, opacity: 0.4}
        break
    }

    return (
      <Box style={style} onClick={onOpenInPopup}>
        <Box style={{...imgStyle, backgroundColor: globalColors.black_05}}>
          {previewPath && <ImageRender style={imgStyle} src={previewPath} />}
        </Box>
        {!isMobile && (messageState === 'downloading' || messageState === 'downloaded') &&
          <ImageIcon
            style={{position: 'relative', right: 19, top: 3}}
            type={messageState === 'downloading' ? 'Downloading' : 'Downloaded'} />}
        {attachmentDurationMs && !previewDurationMs &&
          <Box style={{...globalStyles.flexBoxCenter, position: 'absolute', top: 0, left: 0, bottom: 0, right: 0}}>
            <Icon type='icon-play-64' />
          </Box>
        }
        {attachmentDurationMs && previewType === 'Video' &&
          <Text
            type='BodySemibold'
            style={{position: 'absolute', backgroundColor: globalColors.transparent, color: 'white', fontSize: 12, right: globalMargins.tiny, bottom: globalMargins.xtiny}}
          >{moment.utc(attachmentDurationMs).format('m:ss')}</Text>
        }
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
    ...globalStyles.flexBoxColumn,
    color: type === 'Downloading' ? globalColors.blue : globalColors.green,
  }

  const wrapperStyle = {
    backgroundColor: globalColors.white,
    padding: 3,
    borderRadius: 19,
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

  return (
    <Box style={{...globalStyles.flexBoxColumn, position: 'relative'}}>
      <Box style={{...globalStyles.flexBoxColumn, alignSelf: 'flex-start', position: 'relative'}}>
        <PreviewImage message={message} onOpenInPopup={onOpenInPopup} />
        {_showPreviewProgress(messageState, message.progress) && !!message.progress &&
          <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>
            <ProgressIndicator style={{width: 32}} />
          </Box>
        }
      </Box>
      <Box style={{marginTop: globalMargins.xtiny}}>
        {_showProgressBar(messageState, message.progress) && !!message.progress &&
          <ProgressBar
            style={messageState === 'uploading' ? overlayProgressBarStyle : {}}
            text={messageState === 'downloading' ? 'Downloading' : 'Encrypting'}
            progress={message.progress} />}
        {!isMobile && downloadedPath && <ShowInFileUi downloadedPath={downloadedPath} onOpenInFileUI={onOpenInFileUI} />}
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

        {!isMobile && (_showProgressBar(messageState, progress) || downloadedPath) &&
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
      case 'Video':
        attachment = <AttachmentMessagePreviewImage message={message} onOpenInPopup={this._onOpenInPopup} onOpenInFileUI={this._onOpenInFileUI} />
        break
      default:
        attachment = <AttachmentMessageGeneric message={message} onOpenInFileUI={this._onOpenInFileUI} onLoadAttachment={this._onLoadAttachment} />
    }

    return (
      <MessageWrapper {...this.props}>
        {attachment}
      </MessageWrapper>
    )
  }
}

export {
  ProgressBar,
  ImageIcon,
}
