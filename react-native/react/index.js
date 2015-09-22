'use strict'
/* @flow */

import React from 'react-native'

const {
  AppRegistry,
  Component,
  StyleSheet,
  Text,
  TouchableHighlight,
  View
} = React

import MetaNavigator from './router/meta-navigator'
import commonStyles from './styles/common'

import { Provider } from 'react-redux/native'
import configureStore from './store/configureStore'
const store = configureStore()

import { navigateTo } from './actions/router'

import LoginComponent from './login'
import DebugComponent from './debug'

if (GLOBAL) {
  GLOBAL.store = store // TEMP to test
}

class AppOrDebug extends Component {
  constructor (props) {
    super(props)
  }

  showApp () {
    //this.props.kbNavigator.push({
    //  title: 'Keybase',
    //  component: require('./login'),
    //  saveKey: 'Login',
    //  leftButtonTitle: '¯\\_(ツ)_/¯',
    //  props: {
    //    onLoggedIn: () => {
    //      this.showSearch()
    //    }
    //  }
    //})
  }

  showSearch () {
    this.props.kbNavigator.push({
      title: 'Search',
      component: require('./search'),
      saveKey: 'Search'
    })
  }

  showDebug () {
    this.props.kbNavigator.push({
      title: 'Debug',
      component: require('./debug'),
      saveKey: 'Debug'
    })
  }

  // Auto push to the next state, can't figure out a nicer way to do this
  componentDidMount () {
    this.showApp()
    /*
    if (this.props.navSavedPath.length) {
      switch (this.props.navSavedPath[0].saveKey) {
        case 'Login':
          this.showApp()
          break
        case 'Debug':
          this.showDebug()
          break
      }
    }
    */
  }

  render () {
    const { dispatch } = this.props
    return (
      <View style={styles.appDebug}>
        <TouchableHighlight
          underlayColor={commonStyles.buttonHighlight}
          onPress={() => { dispatch(navigateTo(["login"])) }}>
          <Text style={[commonStyles.button, {width: 200}]} >Keybase</Text>
        </TouchableHighlight>
        <TouchableHighlight
          underlayColor={commonStyles.buttonHighlight}
          onPress={() => { dispatch(navigateTo(["debug"])) }}>
          <Text style={[commonStyles.button, {width: 200}]}>Debug Page</Text>
        </TouchableHighlight>
      </View>
    )
  }
}

AppOrDebug.propTypes = {
  //kbNavigator: React.PropTypes.object.isRequired,
  appOrDebug: React.PropTypes.string,
  navSavedPath: React.PropTypes.array
}

class Keybase extends Component {
  constructor () {
    super()
  }

  render () {
    return (
      <Provider store={store}>
        {() =>
        {// TODO(mm): maybe not pass in store? and use connect
          return (
            <MetaNavigator
              store={store}
              rootRouteParser={Keybase.parseRoute}/>
          )
        }}
      </Provider>
    )
  }

  //TODO(mm): annotate types
  // store is our redux store
  // route is the array form of our route (e.g. ["foo","bar"] instead of "foo/bar")
  static parseRoute(store, route) {
    const routes = {
      'login': LoginComponent.parseRoute,
      'debug': DebugComponent.parseRoute
    }

    const [top, ...rest] = route;

    const componentAtTop = {
      title: 'App or Debug',
      mapStateToProps: state => state.login,
      component : AppOrDebug
    }

    return {
      componentAtTop,
      restRoutes: rest,
      parseNextRoute: routes[top] || null
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
