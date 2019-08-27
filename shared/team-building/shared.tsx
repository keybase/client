import * as Styles from '../styles'
import {ServiceIdWithContact, ServiceMap} from '../constants/types/team-building'
import {IconType} from '../common-adapters/icon.constants'
import Flags from '../util/feature-flags'
import {allServices} from '../constants/team-building'

const services: {
  [K in ServiceIdWithContact]: {
    color: string
    icon: IconType
    label: string
    longLabel: string
    searchPlaceholder: string
    wonderland?: boolean
  }
} = {
  contact: {
    color: '#000',
    icon: 'iconfont-identity-twitter',
    label: 'Your contacts', // TODO: rethink this for the empty state when we're actually using it
    longLabel: 'A contact',
    searchPlaceholder: 'contacts',
  },
  email: {
    color: '#4C8EFF',
    icon: 'iconfont-mention',
    label: 'Email', // TODO: rethink this for the empty state when we're actually using it
    longLabel: 'An email address',
    searchPlaceholder: 'email',
    wonderland: true,
  },
  facebook: {
    color: '#3B5998',
    icon: 'iconfont-identity-facebook',
    label: 'Facebook',
    longLabel: 'A Facebook user',
    searchPlaceholder: 'Facebook',
  },
  github: {
    color: '#333',
    icon: 'iconfont-identity-github',
    label: 'GitHub',
    longLabel: 'A GitHub user',
    searchPlaceholder: 'GitHub',
  },
  hackernews: {
    color: '#FF6600',
    icon: 'iconfont-identity-hn',
    label: 'Hacker News',
    longLabel: 'A Hacker News user',
    searchPlaceholder: 'Hacker News',
  },
  keybase: {
    color: '#4C8EFF',
    icon: 'iconfont-contact-book',
    label: 'Keybase and contacts',
    longLabel: Styles.isMobile ? 'Keybase & Contacts' : 'A Keybase user',
    searchPlaceholder: Styles.isMobile ? 'Keybase & contacts' : 'Keybase',
  },
  pgp: {
    color: '#000',
    icon: 'iconfont-identity-pgp',
    label: 'PGP',
    longLabel: 'A PGP user',
    searchPlaceholder: 'PGP',
  },
  phone: {
    color: '#4C8EFF',
    icon: 'iconfont-number-pad',
    label: 'Phone',
    longLabel: 'A phone number',
    searchPlaceholder: 'phone',
    wonderland: true,
  },
  reddit: {
    color: '#ff4500',
    icon: 'iconfont-identity-reddit',
    label: 'Reddit',
    longLabel: 'A Reddit user',
    searchPlaceholder: 'Reddit',
  },
  twitter: {
    color: '#1DA1F2',
    icon: 'iconfont-identity-twitter',
    label: 'Twitter',
    longLabel: 'A Twitter user',
    searchPlaceholder: 'Twitter',
  },
}

const serviceIdToAccentColor = (service: ServiceIdWithContact): string => services[service].color
const serviceIdToIconFont = (service: ServiceIdWithContact): IconType => services[service].icon
const serviceIdToLabel = (service: ServiceIdWithContact): string => services[service].label
const serviceIdToLongLabel = (service: ServiceIdWithContact): string => services[service].longLabel
const serviceIdToSearchPlaceholder = (service: ServiceIdWithContact): string =>
  services[service].searchPlaceholder
const serviceIdToWonderland = (service: ServiceIdWithContact): boolean =>
  Flags.wonderland && services[service].wonderland === true

const inactiveServiceAccentColor = Styles.globalColors.black

const serviceMapToArray = (services: ServiceMap) => allServices.filter(x => x !== 'keybase' && x in services)

export {
  serviceIdToIconFont,
  serviceIdToAccentColor,
  inactiveServiceAccentColor,
  serviceIdToLabel,
  serviceIdToLongLabel,
  serviceIdToSearchPlaceholder,
  serviceIdToWonderland,
  serviceMapToArray,
}
