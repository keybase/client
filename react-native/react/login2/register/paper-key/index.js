'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  StyleSheet,
  Text,
  View
} from 'react-native'

export default class PaperKey extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>Paper key</Text>
        <Text>Enter</Text>
        <Text>Submit</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = { }

    const componentAtTop = {
      title: '',
      component: PaperKey,
      leftButtonTitle: '',
      mapStateToProps: state => state.login2
    }

    // Default the next route to the login form
    const parseNextRoute = routes[nextPath.get('path')]

    return {
      componentAtTop,
      parseNextRoute
    }
  }

}

PaperKey.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

