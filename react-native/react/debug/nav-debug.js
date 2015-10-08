'use strict'

/* shows how the meta navigator works */

import React, { Component, View, Text, StyleSheet } from 'react-native'
import { navigateTo, routeAppend, navigateUp } from '../actions/router'

function mapStateToGetURI (state) {
  return state.tabbedRouter.getIn([
    'tabs',
    state.tabbedRouter.get('activeTab')
  ]).toObject()
}

export default class NavDebug extends Component {
  constructor () {
    super()

    this.state = {
      mock: {
        sessionID: 124,
        devices: [
          {
            type: 'desktop',
            name: 'b',
            deviceID: 'e0ce327507bf30e8f7a2512a72bdd318',
            cTime: 0,
            mTime: 0
          }
        ],
        hasPGP: false,
        hasPaperBackupKey: false
      }
    }
  }

  render () {
    return (
      <View style={{flex: 1, marginTop: 100}}>
        <Text style={{textAlign: 'center'}}>In debug</Text>
        <Text style={{textAlign: 'center'}}>URI: {JSON.stringify(this.props.uri.toJSON())}</Text>
        <Text
          style={styles.button}
          onPress={() => this.props.dispatch(navigateTo(['navDebug', 'page2']))}>Click here to go somewhere</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = {
      'page2': DebugPage2.parseRoute
    }

    const componentAtTop = {
      title: 'Debug',
      mapStateToProps: mapStateToGetURI,
      component: NavDebug
    }

    return {
      componentAtTop,
      parseNextRoute: routes[nextPath.get('path')] || null
    }
  }
}

NavDebug.propTypes = {
  dispatch: React.PropTypes.object.isRequired,
  uri: React.PropTypes.object.isRequired
}

class DebugPage2 extends Component {
  render () {
    return (
      <View style={{flex: 1, marginTop: 100}}>
        <Text style={{textAlign: 'center'}}>Page 2</Text>
        <Text style={{textAlign: 'center'}}>URI: {JSON.stringify(this.props.uri.toJSON())}</Text>
        <Text
          style={styles.button}
          onPress={() => this.props.dispatch(navigateUp())}>Go up the nav hierarchy</Text>
        <Text
          style={styles.button}
          onPress={() => this.props.dispatch(routeAppend('page3'))}>infinite recursion</Text>
        <Text
          style={styles.button}
          onPress={() => this.props.dispatch(navigateTo(['navDebug']))}>go back to debug</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = {
      page3: DebugPage3.parseRoute
    }

    const componentAtTop = {
      title: 'Debug Page 2',
      mapStateToProps: mapStateToGetURI,
      component: DebugPage2
    }

    return {
      componentAtTop,
      parseNextRoute: routes[nextPath.get('path')] || null
    }
  }
}

DebugPage2.propTypes = {
  dispatch: React.PropTypes.object.isRequired,
  uri: React.PropTypes.object.isRequired
}

class DebugPage3 extends Component {
  render () {
    return (
      <View style={{flex: 1, marginTop: 100}}>
        <Text style={{textAlign: 'center'}}>Page 3</Text>
        <Text style={{textAlign: 'center'}}>URI: {JSON.stringify(this.props.uri.toJSON())}</Text>
        <Text
          style={styles.button}
          onPress={() => this.props.dispatch(navigateUp())}>Go up the nav hierarchy</Text>
        <Text
          style={styles.button}
          onPress={() => this.props.dispatch(routeAppend('page2'))}>infinite recursion</Text>
        <Text
          style={styles.button}
          onPress={() => this.props.dispatch(navigateTo([]))}>go back to more</Text>
      </View>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    const routes = {
      page2: DebugPage2.parseRoute
    }

    const componentAtTop = {
      title: 'Debug Page 3',
      mapStateToProps: mapStateToGetURI,
      component: DebugPage3
    }

    return {
      componentAtTop,
      parseNextRoute: routes[nextPath.get('path')] || null
    }
  }
}

DebugPage3.propTypes = {
  dispatch: React.PropTypes.object.isRequired,
  uri: React.PropTypes.object.isRequired
}

const styles = StyleSheet.create({
  button: {
    fontSize: 30,
    marginTop: 20,
    marginBottom: 20,
    textAlign: 'center',
    color: 'blue'
  }
})
