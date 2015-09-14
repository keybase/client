'use strict'

var React = require('react-native')
var {
  Component,
  PixelRatio,
  Navigator,
  ScrollView,
  Settings,
  StyleSheet,
  Text,
  TouchableHighlight,
  TouchableOpacity,
  View,
} = React

class NavButton extends Component {
  render () {
    return (
      <TouchableHighlight
        style={styles.button}
        underlayColor='#B5B5B5'
        onPress={this.props.onPress}>
        <Text style={styles.buttonText}>{this.props.text}</Text>
      </TouchableHighlight>
    )
  }
}

var NavigationBarRouteMapper = {
  LeftButton: function(route, navigator, index, navState) {
    if (route.leftButton) {
      return route.leftButton
    }

    if (index === 0) {
      return null
    }

    var previousRoute = navState.routeStack[index - 1]
    return (
      <TouchableOpacity
        onPress={() => {
          for(var i = route.leftButtonPopN ? route.leftButtonPopN : 1 ; i > 0 ; --i) {
            navigator.pop()
          }
          // doesn't work? navigator.popN(route.leftButtonPopN ? route.leftButtonPopN : 1)
        }}
        style={styles.navBarLeftButton}>
        <Text style={[styles.navBarText, styles.navBarButtonText]}>
          {route.leftButtonTitle || previousRoute.title}
        </Text>
      </TouchableOpacity>
    )
  },

  RightButton: function(route, navigator, index, navState) {
    return route.rightButton
  },

  Title: function(route, navigator, index, navState) {
    return (
      <Text style={[styles.navBarText, styles.navBarTitleText]}>
        {route.title}
      </Text>
    )
  }
}

class KBNavigator extends Component {

  constructor () {
    super()

    this.pushQueue = []
  }
  componentWillMount () {
    // this.savedPath = []
    this.savedPath = Settings.get(this.props.saveName) || []
  }
  componentWillUnmount () { }

  push (route) {
    this.pushQueue.push(this.decorateRoute(route))
    this.clearPushQueue()
  }

  clearPushQueue () {
    if (!this.navigator) {
      return
    }

    // while loop to allow things to keep pushing while we iterate
    while (this.pushQueue.length) {
      this.navigator.push(this.pushQueue.shift())
    }
  }

  decorateRoute (route) {
    var decorated = {
      ...route,
      navSavedPath: this.savedPath.concat()
    }

    if (this.savedPath.length) {
      this.savedPath.shift()
    }

    return decorated
  }

  savePath () {
    if (!this.navigator) {
      return
    }

    var toSave = {}

    var routes = this.navigator.getCurrentRoutes().slice(1).map(function (r) {
      return {
        saveKey: r.saveKey,
        props: r.props
      }
    })

    toSave[this.props.saveName] = routes
    Settings.set(toSave)
  }

  configureScene (route) {
    return Navigator.SceneConfigs.FloatFromRight
  }

  render () {
    return (
      <Navigator
        debugOverlay={false}
        ref={(navigator) => {
          this.navigator = navigator
          this.clearPushQueue()
        }}
        style={styles.appContainer}
        initialRoute={this.decorateRoute(this.props.initialRoute)}
        renderScene={(route, navigator) => {
          this.savePath()

          return React.createElement(route.component, {
            navigator,
            kbNavigator: this,
            navSavedPath: route.navSavedPath,
            ...route.props
          })}
        }
        navigationBar={
          <Navigator.NavigationBar
            routeMapper={NavigationBarRouteMapper}
            style={styles.navBar}
          />
        }
      />
    )
  }
}

var styles = StyleSheet.create({
  messageText: {
    fontSize: 17,
    fontWeight: '500',
    padding: 15,
    marginTop: 50,
    marginLeft: 15,
  },
  button: {
    backgroundColor: 'white',
    padding: 15,
    borderBottomWidth: 1 / PixelRatio.get(),
    borderBottomColor: '#CDCDCD',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '500',
  },
  navBar: {
    backgroundColor: 'white',
  },
  navBarText: {
    fontSize: 16,
    marginVertical: 10,
  },
  navBarTitleText: {
    color: 'blue',
    fontWeight: '500',
    marginVertical: 9,
  },
  navBarLeftButton: {
    paddingLeft: 10,
  },
  navBarRightButton: {
    paddingRight: 10,
  },
  navBarButtonText: {
    color: 'blue'
  },
  scene: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: '#EAEAEA',
  },
})

module.exports = KBNavigator

