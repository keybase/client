'use strict'
/* @flow */

const React = require('react-native')
const LoginComponent = require('../login')
const DebugComponent = require('../debug')
const commonStyles = require('../styles/common')
const {navigateTo} = require('../actions/router')

const {
  Component,
  Text,
  TouchableHighlight,
  View
} = React

class More extends Component {

  render () {
    const {dispatch} = this.props
    return (
      <View>
        <TouchableHighlight
          underlayColor={commonStyles.buttonHighlight}
          onPress={() => { dispatch(navigateTo(['login'])) }}>
          <Text style={[commonStyles.button, {width: 200}]} >Keybase</Text>
        </TouchableHighlight>
        <TouchableHighlight
          underlayColor={commonStyles.buttonHighlight}
          onPress={() => { dispatch(navigateTo(['debug'])) }}>
          <Text style={[commonStyles.button, {width: 200}]}>Debug Page</Text>
        </TouchableHighlight>
      </View>
    )
  }

  // TODO(mm): annotate types
  // store is our redux store
  static parseRoute (store, currentPath, nextPath) {
    const routes = {
      'login': LoginComponent.parseRoute,
      'debug': DebugComponent.parseRoute
    }

    const componentAtTop = {
      component: More
    }

    return {
      componentAtTop,
      parseNextRoute: routes[nextPath.get('path')] || null
    }
  }
}

More.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}

module.exports = More
