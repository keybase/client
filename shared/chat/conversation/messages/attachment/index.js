// @flow
import * as Constants from '../../../../constants/chat'
import moment from 'moment'
import React from 'react'
import {Box, Icon, ProgressIndicator, Text, ClickableBox} from '../../../../common-adapters'
import {isMobile, fileUIName} from '../../../../constants/platform'
import {globalStyles, globalMargins, globalColors} from '../../../../styles'
import {ImageRender} from './image'

import type {Props, ProgressBarProps, ImageIconProps} from '.'

const AttachmentTitle = ({
  messageState,
  title,
  onOpenInPopup,
}: {
  messageState: Constants.AttachmentMessageState,
  title: ?string,
  onOpenInPopup: ?() => void,
}) => {
  let style = {
    backgroundColor: globalColors.white,
  }
  switch (messageState) {
    case 'uploading':
    case 'pending':
    case 'failed':
    case 'placeholder':
      style = {backgroundColor: globalColors.white, color: globalColors.black_40}
      break
  }
  return <Text type="BodySemibold" style={style} onClick={onOpenInPopup}>{title}</Text>
}

function PreviewImage({
  message: {
    attachmentDurationMs,
    previewDurationMs,
    previewPath,
    previewType,
    previewSize,
    messageState,
    downloadProgress,
    downloadedPath,
    savedPath,
  },
  onMessageAction,
  onOpenInPopup,
}: {
  message: Constants.AttachmentMessage,
  onMessageAction: ?() => void,
  onOpenInPopup: ?() => void,
}) {
  if (previewType === 'Image' || previewType === 'Video') {
    let style = {
      ...globalStyles.flexBoxRow,
      alignItems: 'flex-end',
      marginTop: globalMargins.xtiny,
      position: 'relative',
    }
    const imgStyle = {
      borderRadius: 4,
      ...(previewSize
        ? {height: previewSize.height, width: previewSize.width}
        : {maxHeight: 320, maxWidth: 320}),
    }

    switch (messageState) {
      case 'uploading':
      case 'pending':
      case 'failed':
        style = {...style, opacity: 0.4}
        break
    }

    return (
      <ClickableBox style={style} onClick={onOpenInPopup} onLongPress={onMessageAction}>
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            alignItems: 'flex-end',
            position: 'relative',
          }}
        >
          <Box style={{...imgStyle, backgroundColor: globalColors.black_05}}>
            {previewPath && <ImageRender style={imgStyle} src={previewPath} />}
          </Box>
          {!isMobile &&
            (savedPath || (savedPath === false && downloadProgress !== null)) &&
            <ImageIcon
              style={{position: 'relative', right: 19, top: 3}}
              type={savedPath ? 'Downloaded' : 'Downloading'}
            />}
          {attachmentDurationMs &&
            !previewDurationMs &&
            previewPath &&
            <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>
              <Icon type="icon-play-64" />
            </Box>}
          {attachmentDurationMs &&
            previewType === 'Video' &&
            <Text
              type="BodySemibold"
              style={{
                backgroundColor: globalColors.transparent,
                bottom: globalMargins.xtiny,
                color: 'white',
                fontSize: 12,
                position: 'absolute',
                right: globalMargins.tiny,
              }}
            >
              {moment.utc(attachmentDurationMs).format('m:ss')}
            </Text>}
        </Box>
      </ClickableBox>
    )
  }

  return null
}

function ProgressBar({text, progress, style}: ProgressBarProps) {
  const basicStyle = {borderRadius: 4, height: 4, width: 64}
  const containerStyle = {
    ...globalStyles.flexBoxRow,
    ...globalStyles.rounded,
    alignItems: 'center',
    backgroundColor: globalColors.white,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 0,
    ...style,
  }

  return (
    <Box style={containerStyle}>
      <Text type={'BodySmall'} style={{marginRight: globalMargins.xtiny}}>{text}</Text>
      <Box
        style={{
          ...basicStyle,
          backgroundColor: globalColors.black_05,
          marginLeft: globalMargins.xtiny,
          marginTop: 2,
        }}
      >
        <Box style={{...basicStyle, backgroundColor: globalColors.blue, width: 64 * progress}} />
      </Box>
    </Box>
  )
}

function ImageIcon({type, style}: ImageIconProps) {
  const iconStyle = {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColors.white,
    color: type === 'Downloading' ? globalColors.blue : globalColors.green,
  }

  const wrapperStyle = {
    backgroundColor: globalColors.white,
    borderRadius: 19,
    padding: 3,
  }

  return (
    <Box style={{...wrapperStyle, ...style}}>
      <Icon type="iconfont-import" style={iconStyle} />
    </Box>
  )
}

const ShowInFileUi = ({onOpenInFileUI}) => (
  <Text type="BodySmallSecondaryLink" onClick={onOpenInFileUI}>Show in {fileUIName}</Text>
)

function PreviewImageWithInfo({
  message,
  onMessageAction,
  onOpenInFileUI,
  onOpenInPopup,
}: {
  message: Constants.AttachmentMessage,
  onMessageAction: ?() => void,
  onOpenInFileUI: () => void,
  onOpenInPopup: ?() => void,
}) {
  const {savedPath, messageState, downloadProgress, uploadProgress} = message

  const overlayProgressBarStyle = {
    bottom: globalMargins.xtiny,
    left: 0,
    paddingBottom: globalMargins.xtiny,
    paddingLeft: globalMargins.xtiny,
    paddingRight: globalMargins.tiny,
    paddingTop: globalMargins.xtiny,
    position: 'absolute',
  }

  return (
    <Box style={{...globalStyles.flexBoxColumn, position: 'relative'}}>
      <Box style={{...globalStyles.flexBoxColumn, alignSelf: 'flex-start', position: 'relative'}}>
        <PreviewImage message={message} onMessageAction={onMessageAction} onOpenInPopup={onOpenInPopup} />
        {(messageState === 'placeholder' || message.previewProgress !== null) &&
          <Box style={{...globalStyles.flexBoxCenter, ...globalStyles.fillAbsolute}}>
            <ProgressIndicator style={{width: 32}} />
          </Box>}
      </Box>
      <Box style={{marginTop: globalMargins.xtiny}}>
        {uploadProgress !== null &&
          <ProgressBar style={overlayProgressBarStyle} text="Encrypting" progress={uploadProgress} />}
        {savedPath === false &&
          downloadProgress !== null &&
          <ProgressBar text="Downloading" progress={downloadProgress} />}
        {!isMobile && savedPath && <ShowInFileUi onOpenInFileUI={onOpenInFileUI} />}
      </Box>
    </Box>
  )
}

function AttachmentIcon({
  message: {messageState, downloadProgress, downloadedPath},
}: {
  message: Constants.AttachmentMessage,
}) {
  let iconType = 'icon-file-24'
  let style = {backgroundColor: globalColors.white, height: 24, marginBottom: 8, marginTop: 8}
  if (downloadProgress !== null) {
    iconType = 'icon-file-downloading-24'
  } else if (downloadedPath) {
    iconType = 'icon-file-downloaded-24'
  } else {
    switch (messageState) {
      case 'uploading':
      case 'pending':
      case 'failed':
        style = {...style, opacity: 0.4}
    }
  }
  return <Icon type={iconType} style={style} />
}

function AttachmentMessageGeneric({
  message,
  onMessageAction,
  onOpenInFileUI,
  onDownloadAttachment,
  onOpenInPopup,
}: {
  message: Constants.AttachmentMessage,
  onMessageAction: () => void,
  onOpenInFileUI: () => void,
  onDownloadAttachment: () => void,
  onOpenInPopup: ?() => void,
}) {
  const {savedPath, messageState, uploadProgress, downloadProgress} = message
  const canOpen = messageState !== 'uploading'
  return (
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        ...(!savedPath ? globalStyles.clickable : {}),
        alignItems: 'center',
      }}
      onClick={!savedPath ? onDownloadAttachment : undefined}
    >
      <AttachmentIcon message={message} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: globalMargins.xtiny}}>
        <AttachmentTitle {...message} onOpenInPopup={canOpen ? onOpenInPopup : null} />

        {!isMobile &&
          (uploadProgress !== null || downloadProgress !== null || savedPath) &&
          <Box style={{height: 14}}>
            {uploadProgress !== null && <ProgressBar text="Encrypting" progress={uploadProgress} />}
            {savedPath === false &&
              downloadProgress !== null &&
              <ProgressBar text="Downloading" progress={downloadProgress} />}
            {savedPath && <ShowInFileUi onOpenInFileUI={onOpenInFileUI} />}
          </Box>}
      </Box>
    </Box>
  )
}

function AttachmentMessagePreviewImage({
  message,
  onMessageAction,
  onOpenInFileUI,
  onOpenInPopup,
}: {
  message: Constants.AttachmentMessage,
  onMessageAction: () => void,
  onOpenInFileUI: () => void,
  onOpenInPopup: ?() => void,
}) {
  const canOpen = message.messageState !== 'uploading'
  return (
    <Box style={{...globalStyles.flexBoxColumn, ...(canOpen ? globalStyles.clickable : {}), flex: 1}}>
      <AttachmentTitle {...message} onOpenInPopup={canOpen ? onOpenInPopup : null} />
      <PreviewImageWithInfo
        message={message}
        onMessageAction={onMessageAction}
        onOpenInFileUI={onOpenInFileUI}
        onOpenInPopup={canOpen ? onOpenInPopup : null}
      />
    </Box>
  )
}

const AttachmentMessage = (props: Props) => {
  switch (props.message.previewType) {
    case 'Image':
    case 'Video':
      return (
        <AttachmentMessagePreviewImage
          message={props.message}
          onMessageAction={props.onAction}
          onOpenInPopup={props.onOpenInPopup}
          onOpenInFileUI={props.onOpenInFileUI}
        />
      )
    default:
      return (
        <AttachmentMessageGeneric
          message={props.message}
          onMessageAction={props.onAction}
          onOpenInFileUI={props.onOpenInFileUI}
          onDownloadAttachment={props.onDownloadAttachment}
          onOpenInPopup={isMobile ? props.onOpenInPopup : null}
        />
      )
  }
}

export default AttachmentMessage

export {ProgressBar, ImageIcon}
