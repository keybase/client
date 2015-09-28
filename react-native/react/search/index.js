'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  Text,
  StyleSheet,
  View
} from 'react-native'

class Search extends Component {
  constructor () {
    super()
  }

  render () {
    return (
      <View style={styles.container}>
        <Text>HI</Text>
      </View>
    )
  }
}

Search.propTypes = {
  kbNavigator: React.PropTypes.object
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
    backgroundColor: '#F5FCFF'
  }
})

export default Search
