// Typed aliases for certain routes so you they are guaranteed to be routed
// correctly

import * as RouteTreeGen from './route-tree-gen'

// TODO i think this should go away. either we dispatch a team building action that's typed that produces these or
// we actually type the routes / props
export const appendPeopleBuilder = () =>
  RouteTreeGen.createNavigateAppend({
    path: [{props: {namespace: 'people', title: ''}, selected: 'peopleTeamBuilder'}],
  })

export const appendWalletPersonBuilder = () =>
  RouteTreeGen.createNavigateAppend({
    path: [{props: {namespace: 'wallets', title: ''}, selected: 'walletTeamBuilder'}],
  })

export const appendNewChatBuilder = () =>
  RouteTreeGen.createNavigateAppend({
    path: [{props: {namespace: 'chat2', title: 'New chat'}, selected: 'chatNewChat'}],
  })

export const appendNewTeamBuilder = (teamname: string) =>
  RouteTreeGen.createNavigateAppend({
    path: [
      {props: {namespace: 'teams', teamname, title: `Add to ${teamname}`}, selected: 'teamsTeamBuilder'},
    ],
  })
