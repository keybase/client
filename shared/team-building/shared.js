// @flow
import * as Styles from '../styles'
import type {ServiceIdWithContact} from '../constants/types/team-building'
import type {IconType} from '../common-adapters/icon.constants'
import {capitalize} from 'lodash-es'

const _serviceIdToIconFont = {
  contact: 'iconfont-identity-twitter',
  facebook: 'iconfont-identity-facebook',
  github: 'iconfont-identity-github',
  hackernews: 'iconfont-identity-hn',
  keybase: 'iconfont-keybase',
  pgp: 'iconfont-identity-pgp',
  reddit: 'iconfont-identity-reddit',
  twitter: 'iconfont-identity-twitter',
}
const serviceIdToIconFont = (service: ServiceIdWithContact): IconType => _serviceIdToIconFont[service]

const _serviceIdToAccentColor = {
  // Service Accent Colors
  // These are custom per service so they may not be associated with the keybase color scheme
  serviceAccentForContact: '#000000',
  serviceAccentForFacebook: '#3B5998',
  serviceAccentForGithub: '#333',
  serviceAccentForHackernews: '#FF6600',
  serviceAccentForKeybase: '#4C8EFF',
  serviceAccentForPgp: '#000000',
  serviceAccentForReddit: '#ff4500',
  serviceAccentForTwitter: '#1DA1F2',
}

const serviceIdToAccentColor = (service: ServiceIdWithContact): string =>
  _serviceIdToAccentColor[`serviceAccentFor${capitalize(service)}`]

const inactiveServiceAccentColor = Styles.globalColors.black_10

export {serviceIdToIconFont, serviceIdToAccentColor, inactiveServiceAccentColor}
