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

const commonServicesReultMapProps = {
  parentProps: {
    style: {
      width: 480,
    },
  },
  showTrackerButton: false,
  id: 0,
  onShowTracker: () => console.log('onShowTracker clicked'),
}

const commonServicesReultMapPropsKB = {
  ...commonServicesReultMapProps,
  leftService: 'Keybase',
  leftIcon: 'jzila',
  leftUsername: 'jzila',
  leftFollowing: true,
  rightService: null,
  rightUsername: null,
  rightFullname: 'John Zila',
  rightIcon: null,
}

const commonServicesReultMapPropsService = {
  ...commonServicesReultMapProps,
  leftUsername: 'jzila',
  leftFollowing: true,
  rightService: null,
  rightUsername: null,
  rightFullname: 'John Zila',
  rightIcon: null,
}

const servicesResultMap: DumbComponentMap<ResultRow> = {
  component: ResultRow,
  mocks: {
    KeybaseNoService: {
      ...commonServicesReultMapPropsKB,
    },
    KeybaseNoServiceNoFollow: {
      ...commonServicesReultMapPropsKB,
      leftFollowing: false,
    },
    KeybaseNoServiceShowTracker: {
      ...commonServicesReultMapPropsKB,
      showTrackerButton: true,
    },
    KeybaseGitHub: {
      ...commonServicesReultMapPropsKB,
      rightFullname: 'John Zila on GitHub',
      rightIcon: 'iconfont-identity-github',
      rightService: 'GitHub',
      rightUsername: 'jzilagithub',
    },
    KeybaseGitHubNoFullname: {
      ...commonServicesReultMapPropsKB,
      rightIcon: 'iconfont-identity-github',
      rightService: 'GitHub',
      rightUsername: 'jzilagithub',
    },
    Twitter: {
      ...commonServicesReultMapPropsService,
      leftIcon: 'icon-twitter-logo-32',
      leftService: 'Twitter',
    },
    TwitterKeybase: {
      ...commonServicesReultMapPropsService,
      leftIcon: 'icon-twitter-logo-32',
      leftService: 'Twitter',
      rightService: 'Keybase',
      rightUsername: 'jzila',
    },
    Facebook: {
      ...commonServicesReultMapPropsService,
      leftIcon: 'icon-facebook-logo-32',
      leftService: 'Facebook',
    },
    GitHub: {
      ...commonServicesReultMapPropsService,
      leftIcon: 'icon-github-logo-32',
      leftService: 'GitHub',
    },
    Reddit: {
      ...commonServicesReultMapPropsService,
      leftIcon: 'icon-reddit-logo-32',
      leftService: 'Reddit',
    },
    'Hacker News': {
      ...commonServicesReultMapPropsService,
      leftIcon: 'icon-hacker-news-logo-32',
      leftService: 'Hacker News',
    },
  },
}

export default {
  'SearchV3 filter': servicesFilterMap,
  'SearchV3 result': servicesResultMap,
}
