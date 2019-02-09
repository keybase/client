// @flow
import * as Styles from '../styles'
import type {ServiceIdWithContact} from '../constants/types/team-building'
import type {IconType} from '../common-adapters/icon.constants'

const services = {
  contact: {
    color: '#000',
    icon: 'iconfont-identity-twitter',
    label: 'Your contacts', // TODO: rethink this for the empty state when we're actually using it
  },
  facebook: {
    color: '#3B5998',
    icon: 'iconfont-identity-facebook',
    label: 'Facebook',
  },
  github: {
    color: '#333',
    icon: 'iconfont-identity-github',
    label: 'GitHub',
  },
  hackernews: {
    color: '#FF6600',
    icon: 'iconfont-identity-hn',
    label: 'Hacker News',
  },
  keybase: {
    color: '#4C8EFF',
    icon: 'iconfont-keybase',
    label: 'Keybase',
  },
  pgp: {
    color: '#000',
    icon: 'iconfont-identity-pgp',
    label: 'PGP',
  },
  reddit: {
    color: '#ff4500',
    icon: 'iconfont-identity-reddit',
    label: 'Reddit',
  },
  twitter: {
    color: '#1DA1F2',
    icon: 'iconfont-identity-twitter',
    label: 'Twitter',
  },
}

const serviceIdToAccentColor = (service: ServiceIdWithContact): string => services[service].color
const serviceIdToIconFont = (service: ServiceIdWithContact): IconType => services[service].icon
const serviceIdToLabel = (service: ServiceIdWithContact): string => services[service].label

const inactiveServiceAccentColor = Styles.globalColors.black_50

export {serviceIdToIconFont, serviceIdToAccentColor, inactiveServiceAccentColor, serviceIdToLabel}
