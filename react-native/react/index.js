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

const Navigator = require('./common/navigator')
const commonStyles = require('./styles/common')

const { Provider } = require('react-redux/native')
const configureStore = require('./store/configureStore')
const store = configureStore()

if (GLOBAL) {
  GLOBAL.store = store // TEMP to test
}

class AppOrDebug extends Component {
  constructor (props) {
    super(props)
  }

  showApp () {
    this.props.kbNavigator.push({
      title: 'Keybase',
      component: require('./login'),
      saveKey: 'Login',
      leftButtonTitle: '¯\\_(ツ)_/¯',
      props: {
        onLoggedIn: () => {
          this.showSearch()
        }
      }
    })
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
    return (
      <View style={styles.appDebug}>
        <TouchableHighlight
          underlayColor={commonStyles.buttonHighlight}
          onPress={() => { this.showApp() }}>
          <Text style={[commonStyles.button, {width: 200}]} >Keybase</Text>
        </TouchableHighlight>
        <TouchableHighlight
          underlayColor={commonStyles.buttonHighlight}
          onPress={() => { this.showDebug() }}>
          <Text style={[commonStyles.button, {width: 200}]}>Debug Page</Text>
        </TouchableHighlight>
      </View>
    )
  }
}

AppOrDebug.propTypes = {
  kbNavigator: React.PropTypes.object,
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
          <Navigator
            saveName='main'
            ref='navigator'
            initialRoute = {{
              title: 'App or Debug',
              component: AppOrDebug
            }}
          />
        }
      </Provider>
    )
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
