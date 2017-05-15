// @flow
import React from 'react'
import Search from '.'
import UserPane from './user-pane/render'
import userPaneMocks from './user-pane/dumb'

import type {DumbComponentMap} from '../constants/types/more'

const results = [
  {
    extraInfo: {
      fullName: 'Chris Coyne',
      isFollowing: true,
      service: 'keybase',
      username: 'chris',
    },
    icon: 'icon-twitter-logo-32',
    keybaseSearchResult: null,
    profileUrl: 'https://twitter.com/malgorithms',
    service: 'external',
    serviceAvatar: '',
    serviceName: 'Twitter',
    username: 'malgorithms',
  },
  {
    extraInfo: {
      fullName: 'John Malg',
      service: 'none',
    },
    isFollowing: false,
    service: 'keybase',
    username: 'malg',
  },
  {
    extraInfo: {
      fullName: 'Malgo Malg',
      service: 'none',
    },
    isFollowing: false,
    service: 'keybase',
    username: 'malgomalg',
  },
  {
    extraInfo: {
      fullNameOnService: 'Chris Coyne',
      icon: 'iconfont-identity-twitter',
      service: 'external',
      serviceAvatar: '',
      serviceUsername: 'malgorithms',
    },
    isFollowing: true,
    service: 'keybase',
    username: 'chris',
  },
  {
    extraInfo: {
      fullName: 'Chris Coyne',
      isFollowing: true,
      service: 'keybase',
      username: 'chris',
    },
    isFollowing: true,
    service: 'keybase',
    username: 'chris2',
  },
]

const commonUsers = [
  {
    extraInfo: {
      fullName: 'Max Krohn',
      service: 'none',
    },
    isFollowing: false,
    service: 'keybase',
    username: 'max',
  },
  {
    extraInfo: {
      fullName: 'John Malg',
      service: 'none',
    },
    isFollowing: false,
    service: 'keybase',
    username: 'malg',
  },
  {
    extraInfo: {
      fullNameOnService: 'Chris Coyne',
      icon: 'icon-twitter-logo-32',
      service: 'external',
      serviceAvatar: '',
      serviceUsername: 'malgorithms',
    },
    icon: 'icon-twitter-logo-32',
    keybaseSearchResult: null,
    profileUrl: 'https://twitter.com/malgorithms',
    service: 'external',
    serviceAvatar: '',
    serviceName: 'Twitter',
    username: 'malgorithms',
  },
]

const commonProps = {
  chatEnabled: false,
  onAddUser: () => console.log('onAddUser'),
  onClickResult: () => console.log('onClickResult'),
  onClickService: () => console.log('onClickService'),
  onClickUserInGroup: u => console.log('onClickUser', u),
  onGroupChat: () => console.log('onGroupChat'),
  onOpenPrivateGroupFolder: () => console.log('onOpenPrivateGroupFolder'),
  onOpenPublicGroupFolder: () => console.log('onOpenPublicGroupFolder'),
  onRemoveUserFromGroup: u => console.log('onRemoveUser', u),
  onReset: () => console.log('onReset'),
  onSearch: text => console.log('OnSearch: ', text),
  results,
  searchHintText: 'Search Keybase',
  searchIcon: 'icon-keybase-logo-32',
  searchText: 'malg',
  searchTextClearTrigger: 1,
  selectedService: 'Keybase',
  selectedUsers: commonUsers,
  showUserGroup: false,
  userForInfoPane: commonUsers[0],
  // prettier-ignore
  // $FlowIssue
  userPane: <UserPane mode='keybase' userInfoProps={userPaneMocks['Search User Pane'].mocks['Unfollowed']} />,
  username: 'bob',
  waiting: false,
}

const searchMap: DumbComponentMap<Search> = {
  component: Search,
  mocks: {
    'Chat enabled': {
      ...commonProps,
      chatEnabled: true,
      showUserGroup: true,
    },
    'Group': {
      ...commonProps,
      showUserGroup: true,
    },
    'Group non-user': {
      ...commonProps,
      showUserGroup: true,
      userForInfoPane: commonUsers[2],
      // prettier-ignore
      // $FlowIssue
      userPane: <UserPane mode='external' nonUserInfoProps={userPaneMocks['Search Non-User Pane'].mocks['Normal']} />,
    },
    'Group non-user Has Invite': {
      ...commonProps,
      showUserGroup: true,
      userForInfoPane: commonUsers[2],
      // prettier-ignore
      // $FlowIssue
      userPane: <UserPane mode='external' nonUserInfoProps={userPaneMocks['Search Non-User Pane'].mocks['Has Invite']} />,
    },
    'Group non-user No Avatar': {
      ...commonProps,
      showUserGroup: true,
      userForInfoPane: commonUsers[2],
      // prettier-ignore
      // $FlowIssue
      userPane: <UserPane mode='external' nonUserInfoProps={userPaneMocks['Search Non-User Pane'].mocks['No Avatar']} />,
    },
    'Group non-user Out of invites': {
      ...commonProps,
      showUserGroup: true,
      userForInfoPane: commonUsers[2],
      // prettier-ignore
      // $FlowIssue
      userPane: <UserPane mode='external' nonUserInfoProps={userPaneMocks['Search Non-User Pane'].mocks['Out of invites']} />,
    },
    'Searching': {
      ...commonProps,
    },
    'Waiting': {
      ...commonProps,
      results: [],
      showUserGroup: true,
      waiting: true,
    },
  },
}

export default {
  'Search': searchMap,
}
