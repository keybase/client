// @flow
import React, {Component} from 'react'
import {
  Box,
  Icon,
  ScrollView,
  Text,
  ProgressIndicator,
  NativeImage,
  ZoomableBox,
} from '../../../common-adapters/index.native'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {formatTimeForPopup} from '../../../util/timestamp'
import {isAndroid, isIPhoneX} from '../../../constants/platform'

import type {Props} from './'

class AutoMaxSizeImage extends Component<any, {width: number, height: number}> {
  state = {height: 0, width: 0}
  _mounted: boolean = false

  componentWillUnmount() {
    this._mounted = false
  }
  componentDidMount() {
    this._mounted = true
    NativeImage.getSize(this.props.source.uri, (width, height) => {
      if (this._mounted) {
        this.setState({height, width})
      }
    })
  }

  render() {
    return isAndroid ? (
      <ZoomableBox style={{position: 'relative', overflow: 'hidden', width: '100%', height: '100%'}}>
        <NativeImage
          {...this.props}
          style={{flex: 1, resizeMode: 'contain', maxHeight: this.state.height, maxWidth: this.state.width}}
        />
      </ZoomableBox>
    ) : (
      <ScrollView
        minimumZoomScale={1}
        // maximumZoomScale arbitrarily set to 10 here.
        // In the future we could set it to max(imageHeight / contentHeight, imageWidth / contentWidth)
        maximumZoomScale={10}
        scrollsToTop={false}
        indicatorStyle="white"
        alwaysBounceVertical={false}
        contentContainerStyle={{flex: 1, position: 'relative'}}
        style={{position: 'relative', overflow: 'hidden', width: '100%', height: '100%'}}
      >
        <NativeImage
          {...this.props}
          style={{flex: 1, resizeMode: 'contain', maxHeight: this.state.height, maxWidth: this.state.width}}
        />
      </ScrollView>
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
    {!!path && <AutoMaxSizeImage source={{uri: `file://${path}`}} />}
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
          paddingTop: isIPhoneX ? globalMargins.medium : undefined,
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
        paddingTop: isIPhoneX ? globalMargins.medium : undefined,
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
