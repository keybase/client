'use strict'
/**
 * @providesModule Meta Navigator
 * A Meta navigator for handling different navigators at the top level.
 * todo(mm) explain why we need a meta navigator
 */

import React from 'react-native'
const {
  Component,
  Navigator,
  Text
  } = React

import { connect } from 'react-redux/native'
//import Navigator from '../common/navigator'

import engine from '../engine'

class MetaNavigator extends Component {
  constructor () {
    super()

    this.state = {
    }
  }

  hasDeeperRoute(restRoutes, parseNextRoute){
    return (parseNextRoute != null);
  }

  render () {
    // TODO (mm): figure out better push pop semantics instead of pwning this everytime
    // use shouldComponentUpdate...

    // TODO (mm): know when to create a new navigator

    // TODO (mm): specify the prop types
    const {store, rootRouteParser } = this.props;

    const route = store.getState().router.uri

    let {componentAtTop, restRoutes, parseNextRoute} = rootRouteParser(store, route)
    // todo(mm): actually store the stack of routes

    let routeStack = [componentAtTop]

    while (this.hasDeeperRoute(restRoutes, parseNextRoute)){
      console.log("rest routes", restRoutes)
      const t = parseNextRoute(store, restRoutes)
      componentAtTop = t.componentAtTop
      restRoutes = t.restRoutes
      parseNextRoute = t.parseNextRoute
      routeStack.push(componentAtTop)
    }


    console.log("Stack:", routeStack)
    console.log("Rendering", componentAtTop)

    return (
      React.createElement(connect(state => state.login)(componentAtTop.component), {...componentAtTop.props})
      // TODO(mm): to focus on the navigation part and not the push/pop we're commenting this out for now.
      //<Navigator
      //  saveName='main'
      //  ref='navigator'
      //  initialRouteStack={routeStack}
      //  renderScene={(route, navigator) => {
      //    console.log("Doing route:", route)
      //    return (
      //      React.createElement(connect(state => state.login)(route.component), {...route.props})
      //    )
      //  }}
      //  // TODO: render the nav bar
      ///>
    )
  }
}

export default connect(state => state)(MetaNavigator)
