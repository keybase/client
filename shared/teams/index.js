// @flow
import TeamsContainer from './render'
import pausableConnect from '../util/pausable-connect'

import type {RouteProps} from '../route-tree/render-route'

// $FlowIssue type this connector
export default pausableConnect(
  (state, {routeSelected, routeLeafTags}: RouteProps<{}, {}>) => ({}),
  (dispatch, {routePath}: RouteProps<{}, {}>) => ({})
)(TeamsContainer)
