'use strict'
/* @flow */

import React from 'react-native'
import {
  Component,
  StyleSheet,
  Text,
  View
} from 'react-native'

export default class ForgotUserPass extends Component {
  render () {
    return (
      <View style={styles.container}>
        <Text>Forgot Username?</Text>
        <Text>Enter user name</Text>
        <Text>Submit</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = { }

    const componentAtTop = {
      title: '',
      component: ForgotUserPass,
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

ForgotUserPass.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

