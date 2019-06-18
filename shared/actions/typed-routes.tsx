// Typed aliases for certain routes so you they are guaranteed to be routed
// correctly

import * as RouteTreeGen from './route-tree-gen'

export const appendNewChatBuilder = () =>
  RouteTreeGen.createNavigateAppend({
    path: [{props: {namespace: 'chat2'}, selected: 'chatNewChat'}],
  })

export const appendNewTeamBuilder = () =>
  RouteTreeGen.createNavigateAppend({
    path: [{props: {namespace: 'teams'}, selected: 'teamsTeamBuilder'}],
  })
