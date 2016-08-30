import React, {Component} from 'react'
import {Text, Box} from '../common-adapters'

export default class ChatRender extends Component {
  render () {
    return (
      <Box style={{flex: 1, justifyContent: 'center', backgroundColor: 'red'}}>
        <Text type='Body'> Error! Tab name was not recognized</Text>
      </Box>
    )
  }
}
