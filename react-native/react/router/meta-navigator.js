'use strict'
/**
 * @providesModule Meta Navigator
 * A Meta navigator for handling different navigators at the top level.
 * todo(mm) explain why we need a meta navigator
 */

const React = require('react-native')
const {
  Component,
  Navigator
  } = React

const { connect } = require('react-redux/native')
const Immutable = require('immutable')

class MetaNavigator extends Component {
  constructor () {
    super()

    this.state = {
    }
  }

  hasDeeperRoute (parseNextRoute) {
    return (parseNextRoute != null)
  }

  isParentOfRoute (routeParent, routeMaybeChild) {
    return (
      !Immutable.is(routeMaybeChild, routeParent) &&
      Immutable.is(routeMaybeChild.slice(0, routeParent.count()), routeParent)
    )
  }

  shouldComponentUpdate (nextProps, nextState) {
    const { store, rootRouteParser } = this.props
    const route = this.props.router.get('uri')
    const nextRoute = nextProps.router.get('uri')

    const { componentAtTop, routeStack: nextRouteStack } = this.getComponentAtTop(rootRouteParser, store, nextRoute)
    if (nextProps === this.props && nextState === this.state) {
      return false
    } else if (this.isParentOfRoute(route, nextRoute)) {
      this.refs.navigator.push(componentAtTop)
      return true
    // TODO: also check to see if this route exists in the navigator's route
    } else if (this.isParentOfRoute(nextRoute, route)) {
      const navRoutes = this.refs.navigator.getCurrentRoutes()
      const targetRoute = navRoutes.reverse().find(navRoute =>
          navRoute.component === componentAtTop.component && navRoute.title === componentAtTop.title
      )
      this.refs.navigator.popToRoute(targetRoute)
      return true
    } else {
      this.refs.navigator.immediatelyResetRouteStack(nextRouteStack.toJS())
      return true
    }
  }

  getComponentAtTop (rootRouteParser, store, uri) {
    let currentPath = uri.first() || Immutable.Map()
    let nextPath = uri.rest().first() || Immutable.Map()
    let restPath = uri.rest().rest()

    let {componentAtTop, parseNextRoute} = rootRouteParser(store, currentPath, nextPath)
    let routeStack = Immutable.List([componentAtTop])

    while (this.hasDeeperRoute(parseNextRoute)) {
      currentPath = nextPath
      nextPath = restPath.first() || Immutable.Map()
      restPath = restPath.rest()
      const t = parseNextRoute(store, currentPath, nextPath)

      componentAtTop = t.componentAtTop
      parseNextRoute = t.parseNextRoute
      routeStack = routeStack.push(componentAtTop)
    }

    return {componentAtTop, routeStack}
  }

  render () {
    // TODO (mm): know when to create a new navigator

    // TODO (mm): specify the prop types
    const { store, rootRouteParser } = this.props

    const uri = store.getState().router.get('uri')

    let {componentAtTop, routeStack} = this.getComponentAtTop(rootRouteParser, store, uri)

    console.log('Stack:', routeStack)
    console.log('Rendering', componentAtTop)
    return (
      <Navigator
        saveName='main'
        ref='navigator'
        initialRouteStack={routeStack.toJS()}
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

MetaNavigator.propTypes = {
  router: React.PropTypes.object.isRequired,
  store: React.PropTypes.object.isRequired,
  rootRouteParser: React.PropTypes.object.isRequired
}

module.exports = connect(state => state)(MetaNavigator)
