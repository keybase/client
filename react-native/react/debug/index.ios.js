'use strict'

/*
 * A debug tab. Use this to jump directly to a part of the app outside of the flow for quick debugging
 */

import React from 'react-native'
const { Component, View, Text } = React

import { navigateTo, routeAppend, navigateUp } from '../actions/router'

class Debug extends Component {
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
      <View style={{flex:1, marginTop:100}}>
        <Text style={{textAlign:"center"}}>In debug</Text>
        <Text
          style={{textAlign:"center", color:"blue"}}
          onPress={()=>this.props.dispatch(navigateTo(["debug","page2"]))}>Click here to go somewhere</Text>
      </View>
    )
  }

  static parseRoute (store, route) {
    const routes = {
      "page2":DebugPage2.parseRoute
    }

    const [top, ...rest] = route;

    const componentAtTop = {
      title: 'Debug',
      component: Debug
    }

    return {
      componentAtTop,
      restRoutes: rest,
      parseNextRoute: routes[top] || null
    }

  }
}

class DebugPage2 extends Component {
  render () {
    return (
      <View style={{flex:1, marginTop:100}}>
        <Text style={{textAlign:"center"}}>Page 2</Text>
        <Text
          style={{textAlign:"center", color:"blue"}}
          onPress={()=>this.props.dispatch(navigateUp())}>Go up the nav hierarchy</Text>
        <Text
          style={{textAlign:"center", color:"blue"}}
          onPress={()=>this.props.dispatch(routeAppend("page3"))}>infinite recursion</Text>
        <Text
          style={{textAlign:"center", color:"blue"}}
          onPress={()=>this.props.dispatch(navigateTo(["debug"]))}>go back to debug</Text>
      </View>
    )
  }

  static parseRoute (store, route) {
    const routes = {
      page3: DebugPage3.parseRoute
    }

    const [top, ...rest] = route;

    const componentAtTop = {
      title: 'Debug Page 2',
      component: DebugPage2
    }

    return {
      componentAtTop,
      restRoutes: rest,
      parseNextRoute: routes[top] || null
    }

  }
}

class DebugPage3 extends Component {
  render () {
    return (
      <View style={{flex:1, marginTop:100}}>
        <Text style={{textAlign:"center"}}>Page 3</Text>
        <Text
          style={{textAlign:"center", color:"blue"}}
          onPress={()=>this.props.dispatch(navigateUp())}>Go up the nav hierarchy</Text>
        <Text
          style={{textAlign:"center", color:"blue"}}
          onPress={()=>this.props.dispatch(routeAppend("page2"))}>infinite recursion</Text>
        <Text
          style={{textAlign:"center", color:"blue"}}
          onPress={()=>this.props.dispatch(navigateTo(["debug"]))}>go back to debug</Text>
      </View>
    )
  }

  static parseRoute (store, route) {
    const routes = {
      page2: DebugPage2.parseRoute
    }

    const [top, ...rest] = route;

    const componentAtTop = {
      title: 'Debug Page 3',
      component: DebugPage3
    }

    return {
      componentAtTop,
      restRoutes: rest,
      parseNextRoute: routes[top] || null
    }

  }
}

Debug.propTypes = {
  navigator: React.PropTypes.object
}

export default Debug
