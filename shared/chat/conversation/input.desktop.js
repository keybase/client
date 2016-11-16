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
      <Box style={{...globalStyles.flexBoxColumn, borderTop: `solid 1px ${globalColors.black_05}`}}>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Input
            small={true}
            style={styleInput}
            ref={this._setRef}
            hintText={`Write to ${this.props.participants.join(', ')}`}
            hideUnderline={false}
            onEnterKeyDown={() => {
              this.props.onPostMessage(this._input.getValue())
              this._input.clearValue()
            }}
          />
          <Icon onClick={() => console.log('emoji callback')} style={styleIcon} type='iconfont-emoji' />
          <Icon onClick={() => console.log('attachment callback')} style={styleIcon} type='iconfont-attachment' />
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
  paddingTop: globalMargins.xtiny,
  paddingLeft: globalMargins.xtiny,
  paddingRight: globalMargins.xtiny,
}

const styleFooter = {
  flex: 1,
  color: globalColors.black_20,
  textAlign: 'right',
  marginTop: 0,
  marginBottom: globalMargins.xtiny,
  marginRight: globalMargins.tiny,
}

export default Conversation
