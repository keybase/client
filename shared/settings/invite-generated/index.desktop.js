// @flow
import React, {Component} from 'react'
import {globalStyles, globalMargins, globalColors} from '../../styles'
import {Box, Button, Icon, Text} from '../../common-adapters'
import {connect} from 'react-redux'
import {navigateUp} from '../../actions/route-tree'

import type {Props} from './index'

class InviteGeneratedRender extends Component<void, Props, void> {
  render() {
    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          flex: 1,
          position: 'relative',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Icon
          type="iconfont-close"
          style={{
            ...globalStyles.clickable,
            position: 'absolute',
            right: globalMargins.small,
            top: globalMargins.small,
          }}
          onClick={this.props.onClose}
        />
        <Icon type="icon-invite-link-48" />
        {this.props.email
          ? <Text type="Body" style={textStyle}>
              Yay! We emailed
              {' '}
              <Text type="BodySemibold">{this.props.email}</Text>
              , but you can also give them the below link:
            </Text>
          : <Text type="Body" style={textStyle}>
              Yay! Please share the below link with your friend. It contains signup &amp; install instructions.
            </Text>}
        <Box style={linkContainerStyle}>
          <Icon
            type="iconfont-link"
            style={{
              color: globalColors.black_10,
              marginRight: globalMargins.tiny,
              height: 14,
            }}
          />
          <Text
            type="BodySemibold"
            style={{...globalStyles.selectable, color: globalColors.green2}}
          >
            {this.props.link}
          </Text>
        </Box>
        <Button
          style={{marginTop: globalMargins.medium}}
          type="Primary"
          label="Close"
          onClick={this.props.onClose}
        />
      </Box>
    )
  }
}

const textStyle = {
  textAlign: 'center',
  paddingTop: globalMargins.medium,
  width: 440,
}

const linkContainerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  borderRadius: 48,
  height: 32,
  marginTop: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  backgroundColor: globalColors.green3,
}

export default connect(
  (state: any, {routeProps: {email, link}}) => ({
    email,
    link,
  }),
  (dispatch: any) => {
    return {
      onClose: () => dispatch(navigateUp()),
    }
  }
)(InviteGeneratedRender)

export {InviteGeneratedRender}
