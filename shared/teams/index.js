// @flow
import TeamsContainer from './render'
import pausableConnect from '../util/pausable-connect'
import openURL from '../util/open-url'

import type {RouteProps} from '../route-tree/render-route'

// $FlowIssue type this connector
export default pausableConnect(
  (state, {routeSelected, routeLeafTags}: RouteProps<{}, {}>) => ({}),
  (dispatch, {routePath}: RouteProps<{}, {}>) => ({
    onCreateTeam: () => {},
    onJoinTeam: () => {},
    onReadDoc: () => {
      openURL('https://keybase.io/docs/command_line/teams_alpha')
    },
  })
)(TeamsContainer)
