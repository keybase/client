'use strict'
/**
 * @providesModule Meta Navigator
 * A Meta navigator for handling different navigators at the top level.
 * todo(mm) explain why we need a meta navigator
 */

import React from 'react-native'
const {
  Component,
  Navigator
  } = React

import { connect } from 'react-redux/native'

class MetaNavigator extends Component {
  constructor () {
    super()

    this.state = {
    }
  }

  hasDeeperRoute (restRoutes, parseNextRoute) {
    return (parseNextRoute != null)
  }

  isParentOfRoute (routeParent, routeMaybeChild) {
    return routeMaybeChild.slice(0, routeParent.length).join(',') === routeParent.join(',')
  }

  shouldComponentUpdate (nextProps, nextState) {
    const { store, rootRouteParser } = this.props
    const route = this.props.router.uri
    const nextRoute = nextProps.router.uri

    const { componentAtTop, routeStack: nextRouteStack } = this.getComponentAtTop(rootRouteParser, store, nextRoute)
    // TODO(mm) use immutablejs
    if (nextProps === this.props && nextState === this.state) {
      return false
    } else if (this.isParentOfRoute(route, nextRoute)) {
      this.refs.navigator.push(componentAtTop)
      return true
    // TODO: also check to see if this route exists in the navigator's route
    } else if (this.isParentOfRoute(nextRoute, route)) {
      const navRoutes = this.refs.navigator.getCurrentRoutes()
      const targetRoute = navRoutes.find(navRoute => {
        return (
          navRoute.component === componentAtTop.component && navRoute.title === componentAtTop.title
        )
      })
      this.refs.navigator.popToRoute(targetRoute)
      return true
    } else {
      this.refs.navigator.immediatelyResetRouteStack(nextRouteStack)
      return true
    }
  }

  getComponentAtTop (rootRouteParser, store, route) {
    let {componentAtTop, restRoutes, parseNextRoute} = rootRouteParser(store, route)
    let routeStack = [componentAtTop]

    while (this.hasDeeperRoute(restRoutes, parseNextRoute)) {
      console.log('rest routes', restRoutes)
      const t = parseNextRoute(store, restRoutes)
      componentAtTop = t.componentAtTop
      restRoutes = t.restRoutes
      parseNextRoute = t.parseNextRoute
      routeStack.push(componentAtTop)
    }

    return {componentAtTop, routeStack}
  }

  render () {
    // TODO (mm): figure out better push pop semantics instead of pwning this everytime
    // use shouldComponentUpdate...

    // TODO (mm): know when to create a new navigator

    // TODO (mm): specify the prop types
    const { store, rootRouteParser } = this.props

    const route = store.getState().router.uri

    let {componentAtTop, routeStack} = this.getComponentAtTop(rootRouteParser, store, route)

    console.log('Stack:', routeStack)
    console.log('Rendering', componentAtTop)
    return (
      // React.createElement(connect(componentAtTop.mapStateToProps || (state => state))(componentAtTop.component), {...componentAtTop.props})
      // TODO(mm): to focus on the navigation part and not the push/pop we're commenting this out for now.
      <Navigator
        saveName='main'
        ref='navigator'
        initialRouteStack={routeStack}
        renderScene={(route, navigator) => {
          console.log('Doing route:', route)
          return (
            React.createElement(connect(componentAtTop.mapStateToProps || (state => state))(route.component), {...route.props})
          )
        }}
        // TODO: render the nav bar
      />
    )
  }
}

export default connect(state => state)(MetaNavigator)
