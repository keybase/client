// @flow
import ServicesFilter from './services-filter'
import ResultRow from './result-row'
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
    style: {
      width: 480,
    },
  },
  showTrackerButton: false,
  id: 0,
  onShowTracker: () => console.log('onShowTracker clicked'),
}

const commonServicesResultMapPropsKB = {
  ...commonServicesResultMapProps,
  leftFollowingState: 'NoState',
  leftIcon: 'jzila',
  leftService: 'Keybase',
  leftUsername: 'jzila',
  rightFollowingState: 'NoState',
  rightFullname: 'John Zila',
  rightIcon: null,
  rightService: null,
  rightUsername: null,
}

const commonServicesResultMapPropsService = {
  ...commonServicesResultMapProps,
  leftFollowingState: 'NoState',
  leftUsername: 'jzila',
  rightFollowingState: 'NoState',
  rightFullname: 'John Zila',
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
      rightFullname: 'John Zila on GitHub',
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

export default {
  'SearchV3 filter': servicesFilterMap,
  'SearchV3 result': servicesResultMap,
}
