'use strict'
/* @flow */

const React = require('react-native')

const {
  AppRegistry,
  Component,
  StyleSheet,
  Text,
  TouchableHighlight,
  View
} = React

const MetaNavigator = require('./router/meta-navigator')
const commonStyles = require('./styles/common')

const { Provider } = require('react-redux/native')
const configureStore = require('./store/configureStore')
const store = configureStore()

const { navigateTo } = require('./actions/router')

const LoginComponent = require('./login')
const DebugComponent = require('./debug')

if (GLOBAL) {
  GLOBAL.store = store // TEMP to test
}

class AppOrDebug extends Component {
  constructor (props) {
    super(props)
  }

  render () {
    const { dispatch } = this.props
    return (
      <View style={styles.appDebug}>
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
}

class Keybase extends Component {
  constructor () {
    super()
  }

  render () {
    return (
      <Provider store={store}>
        {() => {
          // TODO(mm): maybe not pass in store? and use connect
          return (
            <MetaNavigator
              store={store}
              rootRouteParser={Keybase.parseRoute}/>
          )
        }}
      </Provider>
    )
  }

  // TODO(mm): annotate types
  // store is our redux store
  // route is the array form of our route (e.g. ["foo","bar"] instead of "foo/bar")
  static parseRoute (store, currentPath, nextPath) {
    const routes = {
      'login': LoginComponent.parseRoute,
      'debug': DebugComponent.parseRoute
    }

    const componentAtTop = {
      title: 'App or Debug',
      mapStateToProps: state => state.login,
      component: AppOrDebug
    }

    return {
      componentAtTop,
      parseNextRoute: routes[nextPath.get('path')] || null
    }
  }
}

const styles = StyleSheet.create({
  navigator: {
    flex: 1
  },
  appDebug: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
})

AppRegistry.registerComponent('Keybase', () => Keybase)
