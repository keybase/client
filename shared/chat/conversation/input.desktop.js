// @flow
import React, {Component} from 'react'
import {Box, Text, Input} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './'

type State = {
  text: string,
}

class Conversation extends Component<void, Props, State> {
  state: State;
  constructor (props: Props) {
    super(props)
    this.state = {
      text: '',
    }
  }

  render () {
    return (
      <Box style={{...globalStyles.flexBoxRow, minHeight: 48, borderTop: `solid 1px ${globalColors.black_05}`}}>
        <Input
          small={true}
          onChangeText={text => this.setState({text})}
          onEnterKeyDown={() => {
            this.props.onPostMessage(this.state.text)
            this.setState({text: ''})
          }} />
      </Box>
    )
  }
}

export default Conversation
