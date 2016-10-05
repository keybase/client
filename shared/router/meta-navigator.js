// @flow
/**
 * A Meta navigator for handling different navigators at the top level.
 * todo(mm) explain why we need a meta navigator
 */

import React, {Component} from 'react'
import Render from './meta-navigator.render'
import {Map, List, is} from 'immutable'
import {connect} from 'react-redux'
import {printRoutes} from '../local-debug'

type State = {
  navigator: any,
}

type Props = {
  uri: Object,
  rootComponent: any,
  globalRoutes: any,
  NavBar: Object,
  Navigator: Function,
  navBarHeight: number,
}

class MetaNavigator extends Component<void, Props, State> {
  state: State;

  constructor (props) {
    super(props)

    this.state = {
      navigator: null,
    }
  }

  isParentOfRoute (routeParent, routeMaybeChild) {
    return (
      !is(routeMaybeChild, routeParent) &&
      is(routeMaybeChild.slice(0, routeParent.count()), routeParent)
    )
  }

  _resetRouteStack (routeStack) {
    this.state.navigator.immediatelyResetRouteStack(routeStack.toJS())
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (nextProps === this.props) {
      return false
    }

    if (!this.state.navigator) {
      return true
    }

    const route = this.props.uri
    const nextRoute = nextProps.uri

    if (route === nextRoute) {
      return false
    }

    const {rootComponent} = this.props
    const {componentAtTop, routeStack: nextRouteStack} = this.getComponentAtTop(rootComponent, nextRoute)
    const navRoutes = this.state.navigator.getCurrentRoutes()
    const lastNavRoute = navRoutes[navRoutes.length - 1]

    // Let's try to make sure our navigator is in sync with our route state
    if (navRoutes.length !== route.count() || !lastNavRoute.uri || !is(lastNavRoute.uri, route)) {
      this._resetRouteStack(nextRouteStack)
      return true
    }

    if (this.isParentOfRoute(route, nextRoute)) {
      this.state.navigator.push(componentAtTop)
      return true
    // TODO: also check to see if this route exists in the navigator's route
    } else if (this.isParentOfRoute(nextRoute, route)) {
      const targetRoute = navRoutes[nextRouteStack.count() - 1]
      if (is(targetRoute.uri, nextRoute)) {
        this._resetRouteStack(nextRouteStack)
        // This doesn't happen immediately, so it breaks under cases
        // when you pop, then go to another route immediately
        // TODO(MM) maybe future version of RN fixes this
        // We can also hack it and keep track of when we enter the failure mode.
        // this.state.navigator.popToRoute(targetRoute)
      } else {
        this._resetRouteStack(nextRouteStack)
      }
      return true
    } else {
      this._resetRouteStack(nextRouteStack)
      return true
    }
  }

  getComponentAtTop (rootComponent, uri) {
    let currentPath = uri.first() || Map()
    let nextPath = uri.rest().first()
    let restPath = uri.rest().rest()
    let routeStack = List()
    let uriSoFar = List([currentPath])

    let nextComponent = rootComponent
    let parseNextRoute = rootComponent.parseRoute
    let componentAtTop = null

    while (parseNextRoute && currentPath) {
      const t = parseNextRoute(currentPath, uri)
      componentAtTop = {
        ...t.componentAtTop,
        uri: uriSoFar,
        upLink: currentPath.get('upLink'),
        upTitle: currentPath.get('upTitle'),
      }

      // If the component was created through subRoutes we have access to the nextComponent implicitly
      if (!componentAtTop.component && nextComponent) {
        componentAtTop.component = nextComponent
      }

      nextComponent = null
      parseNextRoute = t.parseNextRoute

      // If you return subRoutes, we'll figure out which route is next
      // We also handle globalRoutes here
      if (!parseNextRoute) {
        const subRoutes = {
          ...this.props.globalRoutes,
          ...t.subRoutes,
        }

        if (nextPath && subRoutes[nextPath.get('path')]) {
          nextComponent = subRoutes[nextPath.get('path')]
          parseNextRoute = nextComponent.parseRoute
          if (!parseNextRoute) {
            console.warn(`MetaNavigator: sub-route '${nextPath.get('path')}' lacks a static parseRoute function`)
          }
        }
      }

      // See if they're using an embedded parseRoute
      if (!parseNextRoute && nextPath && nextPath.get('parseRoute')) {
        const result = nextPath.get('parseRoute')
        parseNextRoute = () => result
      }

      routeStack = routeStack.push(componentAtTop)

      currentPath = nextPath
      uriSoFar = uriSoFar.push(currentPath)
      nextPath = restPath.first()
      restPath = restPath.rest()
    }

    if (printRoutes) {
      console.groupCollapsed && console.groupCollapsed(`Routing: ${rootComponent.displayName}/${JSON.stringify(uri.toJS())}`)
      console.log('rootComp', rootComponent)
      console.log('uri', uri.toJS())
      console.log('componentAtTop', componentAtTop)
      console.log('routeStack', routeStack.toJS())
      console.groupEnd && console.groupEnd()
    }

    return {componentAtTop, routeStack}
  }

  render () {
    const {rootComponent, uri, NavBar, Navigator, navBarHeight} = this.props
    return (
      <Render
        uri={uri}
        rootComponent={rootComponent}
        NavBar={NavBar}
        Navigator={Navigator}
        getComponentAtTop={(rootComponent, uri) => this.getComponentAtTop(rootComponent, uri)}
        navBarHeight={navBarHeight}
        setNavigator={navigator => this.setState({navigator})}
      />
    )
  }
}

export default connect(
  (state, ownProps) => state.router.getIn(['tabs', ownProps.tab]).toObject()
)(MetaNavigator)
