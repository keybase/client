/**
 * A Meta navigator for handling different navigators at the top level.
 * todo(mm) explain why we need a meta navigator
 */

import React, {Component} from '../base-react'
import Render from './meta-navigator.render'
import Immutable from 'immutable'
import {connect} from '../base-redux'

class MetaNavigator extends Component {
  constructor (props) {
    super(props)

    this.state = {
      navigator: null
    }
  }

  isParentOfRoute (routeParent, routeMaybeChild) {
    return (
      !Immutable.is(routeMaybeChild, routeParent) &&
      Immutable.is(routeMaybeChild.slice(0, routeParent.count()), routeParent)
    )
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
    if (this.isParentOfRoute(route, nextRoute)) {
      this.state.navigator.push(componentAtTop)
      return true
    // TODO: also check to see if this route exists in the navigator's route
    } else if (this.isParentOfRoute(nextRoute, route)) {
      const navRoutes = this.state.navigator.getCurrentRoutes()
      const targetRoute = navRoutes.reverse().find(navRoute =>
          navRoute.component === componentAtTop.component && navRoute.title === componentAtTop.title
      )
      this.state.navigator.popToRoute(targetRoute)
      return true
    } else {
      this.state.navigator.immediatelyResetRouteStack(nextRouteStack.toJS())
      return true
    }
  }

  getComponentAtTop (rootComponent, uri) {
    let currentPath = uri.first() || Immutable.Map()
    let nextPath = uri.rest().first() || Immutable.Map()
    let restPath = uri.rest().rest()
    let routeStack = Immutable.List()

    let nextComponent = rootComponent
    let parseNextRoute = rootComponent.parseRoute
    let componentAtTop = null

    while (parseNextRoute) {
      const t = parseNextRoute(currentPath, uri)
      componentAtTop = {
        ...t.componentAtTop,
        upLink: currentPath.get('upLink'),
        upTitle: currentPath.get('upTitle')
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
          ...t.subRoutes
        }

        if (subRoutes[nextPath.get('path')]) {
          nextComponent = subRoutes[nextPath.get('path')]
          parseNextRoute = nextComponent.parseRoute
        }
      }

      // See if they're using an embedded parseRoute
      if (!parseNextRoute && nextPath.get('parseRoute')) {
        const result = nextPath.get('parseRoute')
        parseNextRoute = () => result
      }

      routeStack = routeStack.push(componentAtTop)

      currentPath = nextPath
      nextPath = restPath.first() || Immutable.Map()
      restPath = restPath.rest()
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

MetaNavigator.propTypes = {
  uri: React.PropTypes.object.isRequired,
  rootComponent: React.PropTypes.func.isRequired,
  globalRoutes: React.PropTypes.object,
  NavBar: React.PropTypes.object,
  Navigator: React.PropTypes.func,
  navBarHeight: React.PropTypes.number
}

export default connect(
  state => state,
  null,
  (stateProps, dispatchProps, ownProps) => {
    return {
      ...ownProps,
      ...stateProps.tabbedRouter.getIn(['tabs', ownProps.tab]).toObject(),
      ...dispatchProps
    }
  }
)(MetaNavigator)
