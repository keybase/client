// @flow
// Switches between the route-tree router and the new router
import React, {PureComponent} from 'react'
import RenderRoute from '../route-tree/render-route'
import type {RouteDefNode, RouteStateNode, Path} from '../route-tree'
import Router from './router'

type Props = {|
  useNewRouter: boolean,
  oldRouteDef: RouteDefNode,
  oldRouteState: RouteStateNode,
  oldSetRouteState: (path: Path, partialState: {}) => void,
  newRoutePath: any, // TODO add a real type to this
|}

class RouterSwitcheroo extends PureComponent<Props> {
  render() {
    if (this.props.useNewRouter) {
      return <Router />
    }

    return (
      <RenderRoute
        routeDef={this.props.oldRouteDef}
        routeState={this.props.oldRouteState}
        setRouteState={this.props.oldSetRouteState}
      />
    )
  }
}

export default RouterSwitcheroo
