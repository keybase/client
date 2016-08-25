// @flow

import React from 'react'
import Search from './render'
import type {DumbComponentMap} from '../constants/types/more'
import UserPane from './user-pane/render'

import userPaneMocks from './user-pane/dumb'

const results = [
  {
    service: 'external',
    serviceAvatar: '',
    icon: 'icon-twitter-logo-32',
    username: 'malgorithms',
    serviceName: 'Twitter',
    profileUrl: 'https://twitter.com/malgorithms',
    keybaseSearchResult: null,
    extraInfo: {
      service: 'keybase',
      username: 'chris',
      fullName: 'Chris Coyne',
      isFollowing: true,
    },
  },
  {
    service: 'keybase',
    username: 'malg',
    isFollowing: false,
    extraInfo: {
      service: 'none',
      fullName: 'John Malg',
    },
  },
  {
    service: 'keybase',
    username: 'malgomalg',
    isFollowing: false,
    extraInfo: {
      service: 'none',
      fullName: 'Malgo Malg',
    },
  },
  {
    service: 'keybase',
    username: 'chris',
    isFollowing: true,
    extraInfo: {
      service: 'external',
      icon: 'iconfont-identity-twitter',
      serviceUsername: 'malgorithms',
      serviceAvatar: '',
      fullNameOnService: 'Chris Coyne',
    },
  },
  {
    service: 'keybase',
    username: 'chris2',
    isFollowing: true,
    extraInfo: {
      service: 'keybase',
      username: 'chris',
      fullName: 'Chris Coyne',
      isFollowing: true,
    },
  },
]

const commonUsers = [
  {
    service: 'keybase',
    username: 'max',
    isFollowing: false,
    extraInfo: {
      service: 'none',
      fullName: 'Max Krohn',
    },
  },
  {
    service: 'keybase',
    username: 'malg',
    isFollowing: false,
    extraInfo: {
      service: 'none',
      fullName: 'John Malg',
    },
  },
  {
    service: 'external',
    serviceAvatar: '',
    serviceName: 'Twitter',
    icon: 'icon-twitter-logo-32',
    username: 'malgorithms',
    profileUrl: 'https://twitter.com/malgorithms',
    keybaseSearchResult: null,
    extraInfo: {
      service: 'external',
      icon: 'icon-twitter-logo-32',
      serviceUsername: 'malgorithms',
      serviceAvatar: '',
      fullNameOnService: 'Chris Coyne',
    },
  },
]

const commonProps = {
  username: 'bob',
  waiting: false,
  // $FlowIssue
  userPane: <UserPane mode='keybase' userInfoProps={userPaneMocks['Search User Pane'].mocks['Unfollowed']} />,
  onSearch: text => console.log('OnSearch: ', text),
  searchHintText: 'Search Keybase',
  searchText: 'malg',
  searchIcon: 'icon-keybase-logo-32',
  selectedService: 'Keybase',
  onClickService: () => console.log('onClickService'),
  onReset: () => console.log('onReset'),
  onClickResult: () => console.log('onClickResult'),
  results,
  showUserGroup: false,
  onOpenPrivateGroupFolder: () => console.log('onOpenPrivateGroupFolder'),
  onOpenPublicGroupFolder: () => console.log('onOpenPublicGroupFolder'),
  onRemoveUserFromGroup: u => console.log('onRemoveUser', u),
  onClickUserInGroup: u => console.log('onClickUser', u),
  onGroupChat: () => console.log('onGroupChat'),
  onAddUser: () => console.log('onAddUser'),
  chatEnabled: false,
  selectedUsers: commonUsers,
  userForInfoPane: commonUsers[0],
}

const searchMap: DumbComponentMap<Search> = {
  component: Search,
  mocks: {
    'Waiting': {
      ...commonProps,
      waiting: true,
      results: [],
    },
    'Searching': {
      ...commonProps,
    },
    'Group': {
      ...commonProps,
      showUserGroup: true,
    },
    'Group non-user': {
      ...commonProps,
      showUserGroup: true,
      // $FlowIssue
      userPane: <UserPane mode='external' nonUserInfoProps={userPaneMocks['Search Non-User Pane'].mocks['Normal']} />,
      userForInfoPane: commonUsers[2],
    },
    'Group non-user No Avatar': {
      ...commonProps,
      showUserGroup: true,
      // $FlowIssue
      userPane: <UserPane mode='external' nonUserInfoProps={userPaneMocks['Search Non-User Pane'].mocks['No Avatar']} />,
      userForInfoPane: commonUsers[2],
    },
    'Group non-user Out of invites': {
      ...commonProps,
      showUserGroup: true,
      // $FlowIssue
      userPane: <UserPane mode='external' nonUserInfoProps={userPaneMocks['Search Non-User Pane'].mocks['Out of invites']} />,
      userForInfoPane: commonUsers[2],
    },
    'Group non-user Has Invite': {
      ...commonProps,
      showUserGroup: true,
      // $FlowIssue
      userPane: <UserPane mode='external' nonUserInfoProps={userPaneMocks['Search Non-User Pane'].mocks['Has Invite']} />,
      userForInfoPane: commonUsers[2],
    },
    'Chat enabled': {
      ...commonProps,
      showUserGroup: true,
      chatEnabled: true,
    },
  },
}

export default {
  'Search': searchMap,
}
