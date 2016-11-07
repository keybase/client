// @flow
import React, {Component} from 'react'
import {Box, Icon, Input, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'

import type {Props} from './'

class Conversation extends Component<void, Props, void> {
  _input: any

  _setRef = r => {
    this._input = r
  }

  render () {
    return (
      <Box style={{...globalStyles.flexBoxColumn, minHeight: 48, borderTop: `solid 1px ${globalColors.black_05}`}}>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Input
            small={true}
            style={styleInput}
            hintStyle={{textAlign: 'left'}}
            ref={this._setRef}
            hintText={`Write to ${this.props.participants.join(', ')}`}
            underlineShow={false}
            onEnterKeyDown={() => {
              this.props.onPostMessage(this._input.getValue())
              this._input.clearValue()
            }}
          />
          <Icon style={styleIcon} type='iconfont-emoji' />
          <Icon style={styleIcon} type='iconfont-attachment' />
        </Box>
        <Text type='BodySmall' style={styleFooter}>*bold*, _italics_, `code`, >quote</Text>
      </Box>
    )
  }
}

const styleInput = {
  flex: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  textAlign: 'left',
}

const styleIcon = {
  padding: 5,
}

const styleFooter = {
  flex: 1,
  color: globalColors.black_20,
  textAlign: 'right',
  marginTop: 0,
  marginBottom: globalMargins.tiny,
  marginRight: globalMargins.tiny,
}

export default Conversation
