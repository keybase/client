import * as Styles from '../styles'
import {ServiceIdWithContact} from '../constants/types/team-building'
import {IconType} from '../common-adapters/icon.constants'

const services: {
  [K in ServiceIdWithContact]: {color: string; icon: IconType; label: string; longLabel: string}
} = {
  contact: {
    color: '#000',
    icon: 'iconfont-identity-twitter',
    label: 'Your contacts', // TODO: rethink this for the empty state when we're actually using it
    longLabel: 'A contact',
  },
  email: {
    color: '#000',
    icon: 'iconfont-mention',
    label: 'Email', // TODO: rethink this for the empty state when we're actually using it
    longLabel: 'An email address',
  },
  facebook: {
    color: '#3B5998',
    icon: 'iconfont-identity-facebook',
    label: 'Facebook',
    longLabel: 'A Facebook user',
  },
  github: {
    color: '#333',
    icon: 'iconfont-identity-github',
    label: 'GitHub',
    longLabel: 'A GitHub user',
  },
  hackernews: {
    color: '#FF6600',
    icon: 'iconfont-identity-hn',
    label: 'Hacker News',
    longLabel: 'A HN user',
  },
  keybase: {
    color: '#4C8EFF',
    icon: 'iconfont-contact-book',
    label: 'Keybase and contacts',
    longLabel: 'A Keybase user',
  },
  pgp: {
    color: '#000',
    icon: 'iconfont-identity-pgp',
    label: 'PGP',
    longLabel: 'A PGP user',
  },
  phone: {
    color: '#4C8EFF',
    icon: 'iconfont-number-pad',
    label: 'Phone',
    longLabel: 'A phone number',
  },
  reddit: {
    color: '#ff4500',
    icon: 'iconfont-identity-reddit',
    label: 'Reddit',
    longLabel: 'A Reddit user',
  },
  twitter: {
    color: '#1DA1F2',
    icon: 'iconfont-identity-twitter',
    label: 'Twitter',
    longLabel: 'A Twitter user',
  },
}

const serviceIdToAccentColor = (service: ServiceIdWithContact): string => services[service].color
const serviceIdToIconFont = (service: ServiceIdWithContact): IconType => services[service].icon
const serviceIdToLabel = (service: ServiceIdWithContact): string => services[service].label
const serviceIdToLongLabel = (service: ServiceIdWithContact): string => services[service].longLabel

const inactiveServiceAccentColor = Styles.globalColors.black_50

export {
  serviceIdToIconFont,
  serviceIdToAccentColor,
  inactiveServiceAccentColor,
  serviceIdToLabel,
  serviceIdToLongLabel,
}
