import React, {Component, View, Text} from '../base-react'
import {connect} from '../base-redux'

class RegisterPlaceHolder extends Component {
  render () {
    return (<View><Text>TODO when kex2 is done i m p o r t Registration from './login/register'</Text></View>)
  }
}

class Startup extends Component {
  render () {
    return <View><Text>Loading...</Text></View>
  }

  static parseRoute () {
    return {
      componentAtTop: {hideNavBar: true},
      subRoutes: {
        login: require('../login/welcome'),
        // TODO when kex2 is done import Registration from './login/register'
        register: RegisterPlaceHolder
      }
    }
  }
}

export default connect()(Startup)
