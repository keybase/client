// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import MessageWrapper from './wrapper'
import moment from 'moment'
import React, {PureComponent} from 'react'
import {connect} from 'react-redux'
import {Box, Icon, ProgressIndicator, Text, ClickableBox} from '../../../common-adapters'
import {isMobile, fileUIName} from '../../../constants/platform'
import {globalStyles, globalMargins, globalColors} from '../../../styles'
import {ImageRender} from './attachment.render'

import type {Props, ProgressBarProps, ImageIconProps} from './attachment'

function _showProgressBar (messageState, progress) {
  return !!progress && (messageState === 'uploading' || (messageState === 'downloading'))
}

function _showPreviewProgress (messageState, progress) {
  return (!!progress && messageState === 'downloading-preview') || messageState === 'placeholder'
}

function AttachmentTitle ({messageState, title, onOpenInPopup}: {messageState: Constants.AttachmentMessageState, title: ?string, onOpenInPopup: ?() => void}) {
  let style = {
    backgroundColor: globalColors.white,
  }
  switch (messageState) {
    case 'uploading':
    case 'pending':
    case 'failed':
      style = {backgroundColor: globalColors.white, color: globalColors.black_40}
      break
  }
  return <Text type='BodySemibold' style={style} onClick={onOpenInPopup}>{title}</Text>
}

function PreviewImage ({message: {attachmentDurationMs, previewDurationMs, previewPath, previewType, previewSize, messageState}, onMessageAction, onOpenInPopup}: {message: Constants.AttachmentMessage, onMessageAction: ?() => void, onOpenInPopup: ?() => void}) {
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
      <ClickableBox style={style} onClick={onOpenInPopup} onLongPress={onMessageAction}>
        <Box style={{
          ...globalStyles.flexBoxRow,
          position: 'relative',
          alignItems: 'flex-end',
        }}>
          <Box style={{...imgStyle, backgroundColor: globalColors.black_05}}>
            {previewPath && <ImageRender style={imgStyle} src={previewPath} />}
          </Box>
          {!isMobile && (messageState === 'downloading' || messageState === 'downloaded') &&
            <ImageIcon
              style={{position: 'relative', right: 19, top: 3}}
              type={messageState === 'downloading' ? 'Downloading' : 'Downloaded'} />}
          {attachmentDurationMs && !previewDurationMs && messageState !== 'downloading-preview' &&
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
      </ClickableBox>
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
    backgroundColor: globalColors.white,
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

function PreviewImageWithInfo ({message, onMessageAction, onOpenInFileUI, onOpenInPopup}: {message: Constants.AttachmentMessage, onMessageAction: ?() => void, onOpenInFileUI: (path: string) => void, onOpenInPopup: ?() => void}) {
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
        <PreviewImage message={message} onMessageAction={onMessageAction} onOpenInPopup={onOpenInPopup} />
        {_showPreviewProgress(messageState, message.progress) &&
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
  let style = {backgroundColor: globalColors.white, height: 24, marginBottom: 8, marginTop: 8}
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

function AttachmentMessageGeneric ({message, onMessageAction, onOpenInFileUI, onLoadAttachment, onOpenInPopup}: {message: Constants.AttachmentMessage, onMessageAction: () => void, onOpenInFileUI: () => void, onLoadAttachment: () => void, onOpenInPopup: ?() => void}) {
  const {downloadedPath, messageState, progress} = message
  const canOpen = messageState !== 'uploading'
  return (
    <Box style={{...globalStyles.flexBoxRow, ...(!message.downloadedPath ? globalStyles.clickable : {}), alignItems: 'center'}} onClick={!message.downloadedPath ? onLoadAttachment : undefined}>
      <AttachmentIcon messageState={messageState} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: globalMargins.xtiny}}>
        <AttachmentTitle {...message} onOpenInPopup={canOpen ? onOpenInPopup : null} />

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

function AttachmentMessagePreviewImage ({message, onMessageAction, onOpenInFileUI, onOpenInPopup}: {message: Constants.AttachmentMessage, onMessageAction: () => void, onOpenInFileUI: () => void, onOpenInPopup: ?() => void}) {
  const canOpen = message.messageState !== 'uploading'
  return (
    <Box style={{...globalStyles.flexBoxColumn, ...(canOpen ? globalStyles.clickable : {}), flex: 1}}>
      <AttachmentTitle {...message} onOpenInPopup={canOpen ? onOpenInPopup : null} />
      <PreviewImageWithInfo message={message} onMessageAction={onMessageAction} onOpenInFileUI={onOpenInFileUI} onOpenInPopup={canOpen ? onOpenInPopup : null} />
    </Box>
  )
}

type ConnectedProps = Props & { onEnsurePreviewLoaded: () => void }

export class AttachmentMessage extends PureComponent<void, ConnectedProps, void> {
  componentDidMount () {
    if (this.props.message && this.props.message.filename) {
      setImmediate(() => this.props.onEnsurePreviewLoaded())
    }
  }

  componentDidUpdate (prevProps: ConnectedProps) {
    if (this.props.message && prevProps.message && prevProps.message.filename != this.props.message.filename) {
      setImmediate(() => this.props.onEnsurePreviewLoaded())
    }
  }

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

  _onMessageAction = () => {
    this.props.onAction(this.props.message)
  }

  render () {
    const {message} = this.props

    let attachment
    switch (message.previewType) {
      case 'Image':
      case 'Video':
        attachment = <AttachmentMessagePreviewImage message={message} onMessageAction={this._onMessageAction} onOpenInPopup={this._onOpenInPopup} onOpenInFileUI={this._onOpenInFileUI} />
        break
      default:
        attachment = <AttachmentMessageGeneric message={message} onMessageAction={this._onMessageAction} onOpenInFileUI={this._onOpenInFileUI} onLoadAttachment={this._onLoadAttachment} onOpenInPopup={isMobile ? this._onOpenInPopup : null} />
    }

    return (
      <MessageWrapper {...this.props}>
        {attachment}
      </MessageWrapper>
    )
  }
}

export default connect(
  null,
  (dispatch: Dispatch, {message}: Props) => ({
    onEnsurePreviewLoaded: () => dispatch(Creators.loadAttachmentPreview(message)),
  })
)(AttachmentMessage)

export {
  ProgressBar,
  ImageIcon,
}
