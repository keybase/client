'use strict'
/* @flow */

var React = require('react-native')
var {
  AppRegistry,
  Component,
  StyleSheet,
  Text,
  TouchableHighlight,
  View
} = React

var Navigator = require('./common/navigator')
var commonStyles = require('./styles/common')

class AppOrDebug extends Component {
  constructor () {
    super()
  }

  showApp () {
    this.props.kbNavigator.push({
      title: 'Keybase',
      component: require('./login'),
      saveKey: 'Login',
      leftButtonTitle: '¯\\_(ツ)_/¯'
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
      <Navigator
        saveName='main'
        ref='navigator'
        initialRoute = {{
          title: 'App or Debug',
          component: AppOrDebug
        }}
      />
    )
  }
}

AppRegistry.registerComponent('Keybase', () => Keybase)

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

