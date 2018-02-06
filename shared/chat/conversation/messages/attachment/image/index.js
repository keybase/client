// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import {Box, Text, ClickableBox, Icon} from '../../../../../common-adapters'
import {globalStyles, globalMargins, globalColors, fileUIName} from '../../../../../styles'
import {ImageRender} from './image-render'

type Props = {
  loadPreview: () => void,
  message: Types.MessageAttachment,
  onClick: () => void,
  onShowInFinder: ?() => void,
}

class ImageAttachment extends React.PureComponent<Props> {
  componentWillMount() {
    if (!this.props.message.devicePreviewPath) {
      this.props.loadPreview()
    }
  }

  render() {
    const {message} = this.props
    return (
      <ClickableBox style={imageContainerStyle} onClick={this.props.onClick}>
        <Text type="BodySemibold">{message.title || message.filename}</Text>
        <Box
          style={{
            ...(message.devicePreviewPath ? loadedStyle : loadingStyle),
            height: this.props.message.previewHeight,
            width: this.props.message.previewWidth,
          }}
        >
          {message.devicePreviewPath && (
            <ImageRender
              src={message.devicePreviewPath}
              style={{
                ...imageStyle,
                height: this.props.message.previewHeight,
                width: this.props.message.previewWidth,
              }}
            />
          )}
          {this.props.onShowInFinder && (
            <Box style={downloadedIconWrapperStyle}>
              <Icon type="iconfont-import" style={{color: globalColors.green, maxHeight: 14}} />
            </Box>
          )}
        </Box>
        {this.props.onShowInFinder && (
          <Text type="BodySmallPrimaryLink" onClick={this.props.onShowInFinder} style={linkStyle}>
            Show in {fileUIName}
          </Text>
        )}
      </ClickableBox>
    )
  }
}

const downloadedIconWrapperStyle = {
  ...globalStyles.flexBoxCenter,
  backgroundColor: globalColors.white,
  borderRadius: 20,
  bottom: 0,
  padding: 3,
  position: 'absolute',
  right: 0,
}

const imageContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  padding: globalMargins.xtiny,
  width: '100%',
}

const imageStyle = {
  maxWidth: 320,
  position: 'relative',
}

const loadedStyle = {
  ...imageStyle,
}

const loadingStyle = {
  ...imageStyle,
  backgroundColor: globalColors.black_05,
  borderRadius: globalMargins.xtiny,
}

const linkStyle = {
  color: globalColors.black_60,
}

export default ImageAttachment
