// @flow
// Switches between the route-tree router and the new router
import React, {PureComponent} from 'react'
import RenderRoute from '../route-tree/render-route'
import Router from './router'
import {connect} from '../util/container'
import * as ConfigGen from '../actions/config-gen'
import type {RouteDefNode, RouteStateNode, Path} from '../route-tree'

type OwnProps = {|
  useNewRouter: boolean,
  oldRouteDef: RouteDefNode,
  oldRouteState: RouteStateNode,
  oldSetRouteState: (path: Path, partialState: {}) => void,
  newRoutePath: any, // TODO add a real type to this
|}

type Props = {|
  useNewRouter: boolean,
  oldRouteDef: RouteDefNode,
  oldRouteState: RouteStateNode,
  oldSetRouteState: (path: Path, partialState: {}) => void,
  newRoutePath: any, // TODO add a real type to this
  updateNavigator: any => void,
|}

class RouterSwitcheroo extends PureComponent<Props> {
  render() {
    if (this.props.useNewRouter) {
      return <Router ref={r => this.props.updateNavigator(r)} />
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

const mapDispatchToProps = dispatch => ({
  updateNavigator: navigator => dispatch(ConfigGen.createSetNavigator({navigator})),
})

export default connect<OwnProps, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(RouterSwitcheroo)
