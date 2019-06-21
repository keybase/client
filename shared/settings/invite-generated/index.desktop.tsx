import React, {Component} from 'react'
import {
  borderRadius,
  globalStyles,
  globalMargins,
  globalColors,
  collapseStyles,
  desktopStyles,
} from '../../styles'
import {Box, Button, Icon, Text} from '../../common-adapters'

import {Props} from './index'

class InviteGeneratedRender extends Component<Props> {
  render() {
    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Icon type="iconfont-close" style={iconStyle} onClick={this.props.onClose} />
        <Icon type="icon-invite-link-48" />
        {this.props.email ? (
          <Text center={true} type="Body" style={textStyle}>
            Yay! We emailed <Text type="BodySemibold">{this.props.email}</Text>, but you can also give them
            the below link:
          </Text>
        ) : (
          <Text center={true} type="Body" style={textStyle}>
            Yay! Please share the below link with your friend. It contains signup &amp; install instructions.
          </Text>
        )}
        <Box style={linkContainerStyle}>
          <Icon
            type="iconfont-link"
            style={{height: 14, marginRight: globalMargins.tiny}}
            color={globalColors.black_10}
          />
          <Text type="BodySemibold" selectable={true} style={{color: globalColors.greenDark}}>
            {this.props.link}
          </Text>
        </Box>
        <Button style={{marginTop: globalMargins.medium}} label="Close" onClick={this.props.onClose} />
      </Box>
    )
  }
}

const textStyle = {
  paddingTop: globalMargins.medium,
  width: 440,
}

const iconStyle = collapseStyles([
  desktopStyles.clickable,
  {
    position: 'absolute',
    right: globalMargins.small,
    top: globalMargins.small,
  },
])

const linkContainerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.greenLighter,
  borderRadius,
  height: 32,
  marginTop: globalMargins.tiny,
  paddingLeft: globalMargins.xsmall,
  paddingRight: globalMargins.xsmall,
}

export default InviteGeneratedRender
