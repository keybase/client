'use strict'
/* @flow */

import React from 'react-native'
const {
  Component,
  Text,
  StyleSheet,
  View
} = React

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
