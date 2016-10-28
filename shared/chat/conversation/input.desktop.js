// @flow
import React, {Component} from 'react'
import {Box, Input} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './'

class Conversation extends Component<void, Props, void> {
  _input: any

  _setRef = r => {
    this._input = r
  }

  render () {
    return (
      <Box style={{...globalStyles.flexBoxRow, minHeight: 48, borderTop: `solid 1px ${globalColors.black_05}`}}>
        <Input
          small={true}
          style={{flex: 1, textAlign: 'left'}}
          hintStyle={{textAlign: 'left'}}
          ref={this._setRef}
          hintText={`Write to ${this.props.participants.join(', ')}`}
          underlineShow={false}
          onEnterKeyDown={() => {
            this.props.onPostMessage(this._input.getValue())
            this._input.clearValue()
          }}
        />
      </Box>
    )
  }
}

export default Conversation
