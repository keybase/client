// @flow
import React, {Component} from 'react'
import {Box, Icon, Text, ProgressIndicator, NativeImage} from '../../../common-adapters/index.native'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {formatTimeForPopup} from '../../../util/timestamp'

import type {Props} from './'

class AutoMaxSizeImage extends Component<void, any, {width: number, height: number}> {
  state = {height: 0, width: 0}

  componentDidMount() {
    NativeImage.getSize(this.props.source.uri, (width, height) => {
      this.setState({height, width})
    })
  }

  render() {
    return (
      <NativeImage
        {...this.props}
        style={{...this.props.style, maxHeight: this.state.height, maxWidth: this.state.width}}
      />
    )
  }
}

const AttachmentView = ({
  isZoomed,
  onToggleZoom,
  path,
}: {
  isZoomed: boolean,
  onToggleZoom: () => void,
  path: ?string,
}) => (
  <Box style={{...globalStyles.flexBoxCenter, flex: 1}}>
    {!!path &&
      <AutoMaxSizeImage
        source={{uri: `file://${path}`}}
        style={{flex: 1, width: '100%', height: '100%', resizeMode: 'contain', position: 'relative'}}
      />}
    {!path && <ProgressIndicator style={{width: 48}} white={true} />}
  </Box>
)

const AttachmentPopup = ({
  message,
  localMessageState,
  isZoomed,
  onClose,
  onDownloadAttachment,
  onDeleteMessage,
  onMessageAction,
  onToggleZoom,
  onOpenInFileUI,
  you,
}: Props) => {
  const {previewType, title, author, timestamp} = message
  const {downloadedPath} = localMessageState

  if (!previewType || previewType === 'Other') {
    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          ...globalStyles.fillAbsolute,
          backgroundColor: globalColors.white,
        }}
      >
        <Text
          type="Body"
          onClick={onClose}
          style={{
            color: globalColors.blue,
            padding: globalMargins.small,
            borderBottomWidth: 1,
            borderBottomColor: globalColors.black_40,
          }}
        >
          Close
        </Text>
        <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', alignItems: 'center', flex: 1}}>
          <Icon type="icon-file-48" />
          <Text
            type="BodySemibold"
            style={{marginTop: globalMargins.large, marginBottom: globalMargins.tiny}}
          >
            {title}
          </Text>
          <Text type="BodySmall">Sent by {author}</Text>
          <Text type="BodySmall">{formatTimeForPopup(timestamp)}</Text>
          <Text type="BodySmall" style={{color: globalColors.black, marginTop: globalMargins.large}}>
            Your device can not preview this file.
          </Text>
        </Box>
        <Icon type="iconfont-ellipsis" onClick={onMessageAction} style={styleHeaderFooter} />
      </Box>
    )
  }

  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        ...globalStyles.fillAbsolute,
        backgroundColor: globalColors.black,
      }}
    >
      <Text type="Body" onClick={onClose} style={{color: globalColors.white, padding: globalMargins.small}}>
        Close
      </Text>
      <AttachmentView isZoomed={isZoomed} onToggleZoom={onToggleZoom} path={downloadedPath} />
      <Icon
        type="iconfont-ellipsis"
        style={{...styleHeaderFooter, color: globalColors.white}}
        onClick={onMessageAction}
      />
    </Box>
  )
}

const styleHeaderFooter = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  height: 44,
  paddingLeft: globalMargins.small,
}

export default AttachmentPopup
