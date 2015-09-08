'use strict'

var React = require('react-native')
var {
  AppRegistry,
  Component,
  NavigatorIOS,
  Settings,
  StyleSheet,
  Text,
  TouchableHighlight,
  View
} = React

var Login = require('./login')
var Debug = require('./debug')

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

var commonStyles = require('./styles/common')

class AppOrDebug extends Component {
  constructor () {
    super()
  }

  showApp () {
    Settings.set({appOrDebug: 'app'})
    this.props.navigator.push({
      title: 'Keybase',
      component: Login
    })
  }

  showDebug () {
    Settings.set({appOrDebug: 'debug'})
    this.props.navigator.push({
      title: 'Debug',
      component: Debug,
      leftButtonTitle: 'Back',
      onLeftButtonPress: () => this.props.navigator.pop(),
      rightButtonTitle: 'Cancel',
      onRightButtonPress: () => this.props.navigator.pop()
    })
  }

  // Auto push to the next state, can't figure out a nicer way to do this
  componentDidMount () {
    setTimeout(() => {
      var appOrDebug = Settings.get('appOrDebug')
      if (appOrDebug) {
        if (appOrDebug === 'app') {
          this.showApp()
        } else if (appOrDebug === 'debug') {
          this.showDebug()
        }
      }
    }, 1)
  }

  render () {
    return (
      <View style={styles.appDebug}>
        <TouchableHighlight
          underlayColor={commonStyles.buttonHighlight}
          onPress={() => {this.showApp()}}>
          <Text style={[commonStyles.button, {width: 200}]} >Keybase</Text>
        </TouchableHighlight>
        <TouchableHighlight
          underlayColor={commonStyles.buttonHighlight}
          onPress={() => {this.showDebug()}}>
          <Text style={[commonStyles.button, {width: 200}]}>Debug Page</Text>
        </TouchableHighlight>
      </View>
    )
  }
}

AppOrDebug.propTypes = {
  navigator: React.PropTypes.object,
  appOrDebug: React.PropTypes.string
}

class Keybase extends Component {
  constructor () {
    super()
  }

  render () {
    return (
      <NavigatorIOS
        style={styles.navigator}
        initialRoute={{
          title: 'App or Debug',
          component: AppOrDebug
          /* component: Login */
        } }
      />
    )
  }
}

AppRegistry.registerComponent('Keybase', () => Keybase)
