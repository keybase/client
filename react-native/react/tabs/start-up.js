import React, { Component, View, Text } from 'react-native'

class RegisterPlaceHolder extends Component {
  render () {
    return (<View><Text>TODO when kex2 is done i m p o r t Registration from './login2/register'</Text></View>)
  }
}

export default class Startup extends Component {
  render () {
    return <View><Text>Loading...</Text></View>
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        hideNavBar: true
      },
      subRoutes: {
        login: require('../login2/welcome'),
        // TODO when kex2 is done import Registration from './login2/register'
        register: RegisterPlaceHolder
      }
    }
  }
}
