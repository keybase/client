// Typed aliases for certain routes so you they are guaranteed to be routed
// correctly

import * as RouteTreeGen from './route-tree-gen'
import * as TeamTypes from '../constants/types/teams'

// TODO i think this should go away. either we dispatch a team building action that's typed that produces these or
// we actually type the routes / props
export const appendPeopleBuilder = () =>
  RouteTreeGen.createNavigateAppend({
    path: [
      {
        props: {
          filterServices: ['facebook', 'github', 'hackernews', 'keybase', 'reddit', 'twitter'],
          namespace: 'people',
          title: '',
        },
        selected: 'peopleTeamBuilder',
      },
    ],
  })

export const appendWalletPersonBuilder = () =>
  RouteTreeGen.createNavigateAppend({
    path: [
      {
        props: {
          filterServices: ['keybase'],
          namespace: 'wallets',
          title: '',
        },
        selected: 'walletTeamBuilder',
      },
    ],
  })

export const appendNewChatBuilder = () =>
  RouteTreeGen.createNavigateAppend({
    path: [{props: {namespace: 'chat2', title: 'New chat'}, selected: 'chatNewChat'}],
  })

export const appendNewTeamBuilder = (teamID: TeamTypes.TeamID) =>
  RouteTreeGen.createNavigateAppend({
    path: [{props: {namespace: 'teams', teamID, title: ''}, selected: 'teamsTeamBuilder'}],
  })

export const appendEncryptRecipientsBuilder = () =>
  RouteTreeGen.createNavigateAppend({
    path: [
      {
        props: {
          filterServices: ['facebook', 'github', 'hackernews', 'keybase', 'reddit', 'twitter'],
          goButtonLabel: 'Add',
          namespace: 'crypto',
          recommendedHideYourself: true,
          title: 'Recipients',
        },
        selected: 'cryptoTeamBuilder',
      },
    ],
  })
