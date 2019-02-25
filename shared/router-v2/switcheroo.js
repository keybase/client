// @flow
// Switches between the route-tree router and the new router, will go away
import * as React from 'react'
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
|}

type Props = {|
  useNewRouter: boolean,
  oldRouteDef: RouteDefNode,
  oldRouteState: RouteStateNode,
  oldSetRouteState: (path: Path, partialState: {}) => void,
  updateNavigator: any => void,
  persistRoute: any => void,
|}

class RouterSwitcheroo extends React.PureComponent<Props> {
  render() {
    if (this.props.useNewRouter) {
      return <Router ref={r => this.props.updateNavigator(r)} persistRoute={this.props.persistRoute} />
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
  persistRoute: path => dispatch(ConfigGen.createPersistRoute({path})),
  updateNavigator: navigator => dispatch(ConfigGen.createSetNavigator({navigator})),
})

export default connect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(RouterSwitcheroo)
