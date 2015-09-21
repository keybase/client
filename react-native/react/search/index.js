'use strict'
/* @flow */

const React = require('react-native')
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

module.exports = Search
