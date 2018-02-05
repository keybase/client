// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import {Box, Text, ClickableBox} from '../../../../../common-adapters'
import {globalStyles, globalMargins, globalColors} from '../../../../../styles'
import {ImageRender} from './image-render'

type Props = {
  loadPreview: () => void,
  message: Types.MessageAttachment,
  onClick: () => void,
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
        {message.devicePreviewPath ? (
          <ImageRender
            src={message.devicePreviewPath}
            style={{
              ...imageStyle,
              height: this.props.message.previewHeight,
              width: this.props.message.previewWidth,
            }}
          />
        ) : (
          <Box
            style={{
              ...loadingStyle,
              height: this.props.message.previewHeight,
              width: this.props.message.previewWidth,
            }}
          />
        )}
      </ClickableBox>
    )
  }
}

const imageContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  width: '100%',
}

const imageStyle = {
  maxWidth: 320,
}

const loadingStyle = {
  ...imageStyle,
  backgroundColor: globalColors.black_05,
  borderRadius: globalMargins.xtiny,
}

export default ImageAttachment
