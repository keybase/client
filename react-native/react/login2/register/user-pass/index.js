'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  StyleSheet,
  Text,
  View
} from 'react-native'

export default class UserPass extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>UserPass</Text>
        <Text>User</Text>
        <Text>Pass</Text>
        <Text>Submit</Text>
        <Text>Forgot?</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = { }

    const componentAtTop = {
      title: '',
      component: UserPass,
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

UserPass.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

