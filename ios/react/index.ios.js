'use strict'

var React = require('react-native')
var {
  AppRegistry,
  Component,
  NavigatorIOS,
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
    this.navigationBarHidden = true
    this.props.navigator.replace({
      component: Login
    })
  }

  showDebug () {
    this.props.navigator.push({
      title: 'Debug',
      component: Debug,
      leftButtonTitle: 'Back',
      onLeftButtonPress: () => this.props.navigator.pop(),
      rightButtonTitle: 'Cancel',
      onRightButtonPress: () => this.props.navigator.pop()
    })
  }

  render () {
    return (
      <View style={styles.appDebug}>
        <TouchableHighlight underlayColor={commonStyles.buttonHighlight} onPress={() => {this.showApp()}}>
          <Text style={commonStyles.button} >App</Text>
        </TouchableHighlight>
        <TouchableHighlight underlayColor={commonStyles.buttonHighlight} onPress={() => {this.showDebug()}}>
          <Text style={commonStyles.button}>Debug</Text>
        </TouchableHighlight>
      </View>
    )
  }
}

AppOrDebug.propTypes = {navigator: React.PropTypes.object}

class Keybase extends Component {
  constructor () {
    super()
  }

  render () {
    return (
      <NavigatorIOS
        style={styles.navigator}
        initialRoute={{
          title: 'Keybase',
          component: AppOrDebug
        }}
      />
    )
  }
}

AppRegistry.registerComponent('Keybase', () => Keybase)
