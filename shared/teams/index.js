// @flow
import TeamsContainer from './render'
import pausableConnect from '../util/pausable-connect'
import openURL from '../util/open-url'

import type {RouteProps} from '../route-tree/render-route'

// $FlowIssue type this connector
export default pausableConnect(
  (state, {routeSelected, routeLeafTags}: RouteProps<{}, {}>) => ({}),
  (dispatch, {routePath}: RouteProps<{}, {}>) => ({
    onCreateTeam: () => {
      // TODO: Hook this up. Need to change onShowNewTeamDialog to
      // make its conversationIDKey parameter optional first.
      console.log('onCreateTeam not implemented yet')
    },
    onJoinTeam: () => {
      // TODO: Hook this up once we have a join team dialog.
      console.log('onJoinTeam not implemented yet')
    },
    onReadDoc: () => {
      openURL('https://keybase.io/docs/command_line/teams_alpha')
    },
  })
)(TeamsContainer)
