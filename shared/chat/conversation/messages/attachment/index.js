// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
// import moment from 'moment'
import {Box, Icon, ProgressIndicator, Text, ClickableBox} from '../../../../common-adapters'
// import {isMobile, fileUIName} from '../../../../constants/platform'
import {globalStyles, globalMargins, globalColors} from '../../../../styles'
// import {imgMaxWidth} from './image'
import {ImageRender} from './image'

// const maxWidth = imgMaxWidth()

type Props = {
  message: Types.MessageAttachment,
  onClick: () => void,
}

class ImageAttachment extends React.PureComponent<Props> {
  render() {
    const {message} = this.props
    return (
      <ClickableBox style={imageContainerStyle} onClick={this.props.onClick}>
        <Text type="BodySemibold">{message.title || message.filename}</Text>
        {message.devicePreviewPath && <ImageRender src={message.devicePreviewPath} style={imageStyle} />}
      </ClickableBox>
    )
  }
}

class FileAttachment extends React.PureComponent<Props> {
  render() {
    const iconType = 'icon-file-24' // TODO other states
    const {message} = this.props
    return (
      <ClickableBox style={fileContainerStyle} onClick={this.props.onClick}>
        <Icon type={iconType} style={iconStyle} />
        <Text type="BodySemibold">{message.title || message.filename}</Text>
      </ClickableBox>
    )
  }
}

const fileContainerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 40,
  width: '100%',
}

const imageContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  width: '100%',
}

const imageStyle = {
  maxWidth: 320,
}

const iconStyle = {
  marginRight: globalMargins.tiny,
}

export {ImageAttachment, FileAttachment}
