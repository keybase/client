import React, {Component} from 'react'
import {Text, Box} from '../common-adapters'

export default class PeopleRender extends Component {
  render () {
    return (
      <Box style={{flex: 1, justifyContent: 'center'}}>
        <Text type='Body'> People goes here </Text>
        <Text type='Body'> Count: 0</Text>
        <Text type='Body'
          style={{fontSize: 32, marginTop: 20, marginBottom: 20}}>
          I mean, it’s one banana, Michael. What could it cost? Ten dollars?
        </Text>
      </Box>
    )
  }
}
