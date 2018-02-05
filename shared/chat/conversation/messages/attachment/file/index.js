// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import {Icon, Text, ClickableBox} from '../../../../../common-adapters'
import {globalStyles, globalMargins} from '../../../../../styles'

type Props = {
  onClick: () => void,
  message: Types.MessageAttachment,
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

const iconStyle = {
  marginRight: globalMargins.tiny,
}

export default FileAttachment
