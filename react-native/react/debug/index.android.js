'use strict'

/*
 * A debug tab. Use this to jump directly to a part of the app outside of the flow for quick debugging
 */

var React = require('react-native')
var {
  Component,
  StyleSheet,
  View
} = React

var GoTest = require('./go-test')

class Debug extends Component {
  constructor () {
    super()
  }

  render () {
    // TODO: figure out this annoying behavior:
    // If we don't align this to the center the navigator bar overlays it.
    return (
      <View style={styles.appDebug}>
        <GoTest/>
      </View>
    )
  }
}

Debug.propTypes = {
  navigator: React.PropTypes.object
}

var styles = StyleSheet.create({
  navigator: {
    flex: 1
  },
  appDebug: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
})

module.exports = Debug
