import React, {Component} from 'react'
import {Text, Box} from '../common-adapters'

// TODO redo this screen with style guide
const commonStyles = {}

export default class Render extends Component {
  render () {
    return (
      <Box style={styles.container}>
        <Text type='Body' style={[{textAlign: 'center', marginBottom: 75}, commonStyles.h1]}>Version 0.1</Text>
      </Box>
    )
  }
}

const styles = {
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF',
  },
}
