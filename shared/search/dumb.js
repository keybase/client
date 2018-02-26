// @noflow
import * as I from 'immutable'
import {compose, withHandlers, withStateHandlers} from '../util/container'
import ServicesFilter from './services-filter'
import ResultRow from './result-row'
import ResultsList from './results-list'
import UserInput from './user-input'
import {makeState as makeEntitiesState} from '../constants/entities'
import {isMobile} from '../constants/platform'

import type {DumbComponentMap} from '../constants/types/more'

const commonServicesFilterMapProps = {
  onSelectService: service => console.log(`Clicked ${service}`),
}

const servicesFilterMap: DumbComponentMap<ServicesFilter> = {
  component: ServicesFilter,
  mocks: {
    Keybase: {
      ...commonServicesFilterMapProps,
      selectedService: 'Keybase',
    },
    Twitter: {
      ...commonServicesFilterMapProps,
      selectedService: 'Twitter',
    },
    Facebook: {
      ...commonServicesFilterMapProps,
      selectedService: 'Facebook',
    },
    GitHub: {
      ...commonServicesFilterMapProps,
      selectedService: 'GitHub',
    },
    Reddit: {
      ...commonServicesFilterMapProps,
      selectedService: 'Reddit',
    },
    'Hacker News': {
      ...commonServicesFilterMapProps,
      selectedService: 'Hacker News',
    },
  },
}

const commonServicesResultMapProps = {
  parentProps: {
    style: isMobile
      ? {}
      : {
          width: 480,
        },
  },
  showTrackerButton: false,
  id: '0',
  onShowTracker: () => console.log('onShowTracker clicked'),
}

const commonServicesResultMapPropsKB = {
  ...commonServicesResultMapProps,
  leftFollowingState: 'NoState',
  leftFullname: 'John Zila',
  leftIcon: 'jzila',
  leftService: 'Keybase',
  leftUsername: 'jzila',
  rightFollowingState: 'NoState',
  rightIcon: null,
  rightService: null,
  rightUsername: null,
}

const commonServicesResultMapPropsService = {
  ...commonServicesResultMapProps,
  leftFollowingState: 'NoState',
  leftFullname: 'John Zila',
  leftUsername: 'jzila',
  rightFollowingState: 'NoState',
  rightIcon: null,
  rightService: null,
  rightUsername: null,
}

// $FlowIssue doesn't like stateless components
const servicesResultMap: DumbComponentMap<ResultRow> = {
  component: ResultRow,
  mocks: {
    KeybaseNoService: {
      ...commonServicesResultMapPropsKB,
    },
    KeybaseNoServiceFollowing: {
      ...commonServicesResultMapPropsKB,
      leftFollowingState: 'Following',
    },
    KeybaseNoServiceNotFollowing: {
      ...commonServicesResultMapPropsKB,
      leftFollowingState: 'NotFollowing',
    },
    KeybaseNoServiceYou: {
      ...commonServicesResultMapPropsKB,
      leftFollowingState: 'You',
    },
    KeybaseNoServiceNoFollow: {
      ...commonServicesResultMapPropsKB,
      leftFollowing: false,
    },
    KeybaseNoServiceShowTracker: {
      ...commonServicesResultMapPropsKB,
      showTrackerButton: true,
    },
    KeybaseGitHub: {
      ...commonServicesResultMapPropsKB,
      leftFullname: 'John Zila on GitHub',
      rightIcon: 'iconfont-identity-github',
      rightService: 'GitHub',
      rightUsername: 'jzilagithub',
    },
    KeybaseGitHubNoFullname: {
      ...commonServicesResultMapPropsKB,
      rightIcon: 'iconfont-identity-github',
      rightService: 'GitHub',
      rightUsername: 'jzilagithub',
    },
    Twitter: {
      ...commonServicesResultMapPropsService,
      leftIcon: 'icon-twitter-logo-24',
      leftService: 'Twitter',
    },
    TwitterKeybase: {
      ...commonServicesResultMapPropsService,
      leftIcon: 'icon-twitter-logo-24',
      leftService: 'Twitter',
      rightService: 'Keybase',
      rightUsername: 'jzila',
    },
    TwitterKeybaseFollowing: {
      ...commonServicesResultMapPropsService,
      leftIcon: 'icon-twitter-logo-24',
      leftService: 'Twitter',
      rightFollowingState: 'Following',
      rightService: 'Keybase',
      rightUsername: 'jzila',
    },
    TwitterKeybaseNotFollowing: {
      ...commonServicesResultMapPropsService,
      leftIcon: 'icon-twitter-logo-24',
      leftService: 'Twitter',
      rightFollowingState: 'NotFollowing',
      rightService: 'Keybase',
      rightUsername: 'jzila',
    },
    TwitterKeybaseYou: {
      ...commonServicesResultMapPropsService,
      leftIcon: 'icon-twitter-logo-24',
      leftService: 'Twitter',
      rightFollowingState: 'You',
      rightService: 'Keybase',
      rightUsername: 'jzila',
    },
    Facebook: {
      ...commonServicesResultMapPropsService,
      leftIcon: 'icon-facebook-logo-24',
      leftService: 'Facebook',
    },
    GitHub: {
      ...commonServicesResultMapPropsService,
      leftIcon: 'icon-github-logo-24',
      leftService: 'GitHub',
    },
    Reddit: {
      ...commonServicesResultMapPropsService,
      leftIcon: 'icon-reddit-logo-24',
      leftService: 'Reddit',
    },
    'Hacker News': {
      ...commonServicesResultMapPropsService,
      leftIcon: 'icon-hacker-news-logo-24',
      leftService: 'Hacker News',
    },
  },
}

const servicesResultsListMapCommonRows = {
  chris: {
    ...commonServicesResultMapPropsKB,
    leftFollowingState: 'Following',
    leftUsername: 'chris',
    leftFullname: 'chris on GitHub',
    rightIcon: 'iconfont-identity-github',
    rightService: 'GitHub',
    rightUsername: 'chrisname',
  },
  cjb: {
    ...commonServicesResultMapPropsKB,
    leftFollowingState: 'NotFollowing',
    leftUsername: 'cjb',
    leftFullname: 'cjb on facebook',
    rightIcon: 'iconfont-identity-facebook',
    rightService: 'Facebook',
    rightUsername: 'cjbname',
  },
  jzila: {
    ...commonServicesResultMapPropsKB,
    leftFollowingState: 'NoState',
    leftFullname: 'jzila on twitter',
    leftUsername: 'jzila',
    rightIcon: 'iconfont-identity-twitter',
    rightService: 'Twitter',
    rightUsername: 'jzilatwit',
  },
}

Object.keys(servicesResultsListMapCommonRows).forEach(name => {
  servicesResultsListMapCommonRows[name + '-fb'] = {
    ...servicesResultsListMapCommonRows[name],
    leftFollowingState: 'NoState',
    leftIcon: 'icon-facebook-logo-24',
    leftService: 'Facebook',
  }
})

Object.keys(servicesResultsListMapCommonRows).forEach(name => {
  // $FlowIssue gets confused
  servicesResultsListMapCommonRows[name] = I.Record(servicesResultsListMapCommonRows[name])
})

const servicesResultsListMapCommon = {
  mockStore: {
    config: {
      username: 'tester',
      following: {},
    },
    entities: makeEntitiesState({
      searchResults: I.Map(servicesResultsListMapCommonRows),
    }),
  },
  parentProps: {
    style: {
      width: 420,
    },
  },
  selectedId: null,
  showSearchSuggestions: false,
  disableIfInTeamName: '',
}

const servicesResultsListMap: DumbComponentMap<ResultsList> = {
  component: ResultsList,
  mocks: {
    keybaseResults: {
      ...servicesResultsListMapCommon,
      onShowTracker: () => console.log('onShowTracker'),
      onClick: () => console.log('onClick'),
      items: ['chris', 'cjb', 'jzila'],
      keyPath: ['searchChat'],
    },
    keybaseResultsOne: {
      ...servicesResultsListMapCommon,
      onShowTracker: () => console.log('onShowTracker'),
      onClick: () => console.log('onClick'),
      items: ['chris'],
      keyPath: ['searchChat'],
    },
    facebookResults: {
      ...servicesResultsListMapCommon,
      onShowTracker: () => console.log('onShowTracker'),
      onClick: () => console.log('onClick'),
      items: ['chris-fb', 'cjb-fb', 'jzila-fb'],
      keyPath: ['searchChat'],
    },
    noResults: {
      ...servicesResultsListMapCommon,
      onShowTracker: () => console.log('onShowTracker'),
      onClick: () => console.log('onClick'),
      items: [],
      keyPath: ['searchChat'],
    },
  },
}

const commonUserInputMapProps = {
  placeholder: 'Type someone',
  onChangeText: text => console.log(`username text change: ${text}`),
  onRemoveUser: username => console.log(`user removed: ${username}`),
  onClickAddButton: () => console.log('username input add button clicked'),
  onMoveSelectUp: () => console.log('username input moveSelectUp'),
  onMoveSelectDown: () => console.log('username input moveSelectDown'),
  onCancel: () => console.log('username cancel'),
  onAddSelectedUser: () => console.log('on add selected user'),
}

const maxUsers = [
  {followingState: 'You', icon: null, service: 'Keybase', username: 'chromakode', id: 'chromakode'},
  {followingState: 'Following', icon: null, service: 'Keybase', username: 'max', id: 'max'},
  {
    followingState: 'NotFollowing',
    icon: 'icon-twitter-logo-16',
    service: 'Twitter',
    username: 'denormalize',
    id: 'denormalize@twitter',
  },
]

const chrisUsers = [
  {followingState: 'You', icon: null, service: 'Keybase', username: 'chromakode', id: 'chromakode'},
  {followingState: 'Following', icon: null, service: 'Keybase', username: 'chris', id: 'chris'},
  {
    followingState: 'Following',
    icon: 'icon-hacker-news-logo-16',
    service: 'Hacker News',
    username: 'cnojima',
    id: 'cnojima@hackernews',
  },
  {
    followingState: 'NotFollowing',
    icon: 'icon-twitter-logo-16',
    service: 'Twitter',
    username: 'chriscoyier',
    id: 'chriscoyier@twitter',
  },
  {
    followingState: 'NotFollowing',
    icon: 'icon-facebook-logo-16',
    service: 'Facebook',
    username: 'chrisevans',
    id: 'chrisevans@facebook',
  },
  {
    followingState: 'NotFollowing',
    icon: 'icon-github-logo-16',
    service: 'GitHub',
    username: 'defunkt',
    id: 'defunkt@github',
  },
  {
    followingState: 'NotFollowing',
    icon: 'icon-reddit-logo-16',
    service: 'Reddit',
    username: 'KeyserSosa',
    id: 'KeyserSosa@reddit',
  },
]

const userInputMap: DumbComponentMap<UserInput> = {
  component: UserInput,
  mocks: {
    'Empty + Placeholder': {
      ...commonUserInputMapProps,
      userItems: [],
      usernameText: '',
    },
    'Users + Add': {
      ...commonUserInputMapProps,
      userItems: maxUsers,
      usernameText: '',
    },
    'Users + Text': {
      ...commonUserInputMapProps,
      userItems: maxUsers,
      usernameText: 'ma',
    },
    'Users + Text + Clear Search': {
      ...commonUserInputMapProps,
      userItems: maxUsers,
      usernameText: 'ma',
      onClearSearch: () => console.log('on clear search'),
    },
    'Users (Wrap)': {
      ...commonUserInputMapProps,
      parentProps: {
        style: {
          width: isMobile ? 300 : 480,
          padding: 4,
          borderWidth: 2,
          borderColor: 'gray',
          borderStyle: 'solid',
        },
      },
      userItems: chrisUsers,
      usernameText: '',
    },
    'Users (Wrap Add Button)': {
      ...commonUserInputMapProps,
      parentProps: {
        style: {
          width: isMobile ? 300 : 370,
          padding: 4,
          borderWidth: 2,
          borderColor: 'gray',
          borderStyle: 'solid',
        },
      },
      userItems: maxUsers,
      usernameText: '',
    },
    'Users + Text (Wrap)': {
      ...commonUserInputMapProps,
      parentProps: {
        style: {
          width: 460,
          padding: 4,
          borderWidth: 2,
          borderColor: 'gray',
          borderStyle: 'solid',
        },
      },
      userItems: chrisUsers,
      usernameText: 'Chris Hemswor',
    },
  },
}

const UserInputEditable = compose(
  withStateHandlers(props => ({usernameText: '', userItems: props.userItems}), {
    onChangeText: () => usernameText => ({usernameText}),
    setUserItems: () => userItems => ({userItems}),
  }),
  withHandlers({
    onRemoveUser: ({setUserItems, userItems}) => (id: string) => {
      setUserItems(userItems.filter(i => i.id !== id))
    },
  })
)(UserInput)

const userInputEditableMap: DumbComponentMap<UserInputEditable> = {
  component: UserInputEditable,
  mocks: {
    Empty: {
      ...commonUserInputMapProps,
      userItems: [],
    },
    'Users + Add (Wrap)': {
      ...commonUserInputMapProps,
      parentProps: {
        style: {
          width: isMobile ? 300 : 480,
          padding: 4,
          borderWidth: 2,
          borderColor: 'gray',
          borderStyle: 'solid',
        },
      },
      userItems: chrisUsers,
    },
  },
}

export default {
  'Search resultsList': servicesResultsListMap,
  'Search filter': servicesFilterMap,
  'Search user input': userInputMap,
  'Search user input (editable)': userInputEditableMap,
  'Search result': servicesResultMap,
}
