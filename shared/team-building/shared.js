// @flow
import * as Styles from '../styles'
import type {ServiceIdWithContact} from '../constants/types/team-building'
import type {IconType} from '../common-adapters/icon.constants'

// TODO
// use 16px version
// use 14px version

const serviceIdToLogo16 = (service: ServiceIdWithContact, isActive: boolean): IconType => {
  // Round about so that flow is happy
  const map = isActive
    ? {
        contact: 'icon-search-twitter-active-32',
        facebook: 'icon-search-facebook-active-32',
        github: 'icon-search-github-active-32',
        hackernews: 'icon-search-hacker-news-active-32',
        keybase: 'icon-search-keybase-active-32',
        pgp: 'icon-pgp-key-32',
        reddit: 'icon-search-reddit-active-32',
        twitter: 'icon-search-twitter-active-32',
      }
    : {
        contact: 'icon-search-twitter-inactive-32',
        facebook: 'icon-search-facebook-inactive-32',
        github: 'icon-search-github-inactive-32',
        hackernews: 'icon-search-hacker-news-inactive-32',
        keybase: 'icon-search-keybase-inactive-32',
        pgp: 'icon-pgp-key-32',
        reddit: 'icon-search-reddit-inactive-32',
        twitter: 'icon-search-twitter-inactive-32',
      }

  return map[service]
}
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

// Color for an active service id
// These are custom per service so they may not be associated with the keybase color scheme
const _serviceIdToAccentColor = {
  contact: Styles.globalColors.black,
  facebook: '#3B5998',
  github: '#333',
  hackernews: '#FF6600',
  keybase: Styles.globalColors.blue,
  pgp: Styles.globalColors.black,
  reddit: '#ff4500',
  twitter: '#1DA1F2',
}

const serviceIdToAccentColor = (service: ServiceIdWithContact): string => _serviceIdToAccentColor[service]

const inactiveServiceAccentColor = Styles.globalColors.black_20

const serviceIdToLogo14 = (service: ServiceIdWithContact): IconType =>
  ({
    contact: 'icon-twitter-logo-32',
    facebook: 'icon-facebook-logo-32',
    github: 'icon-github-logo-32',
    hackernews: 'icon-hacker-news-logo-32',
    keybase: 'icon-keybase-logo-32',
    pgp: 'icon-pgp-key-32',
    reddit: 'icon-reddit-logo-32',
    twitter: 'icon-twitter-logo-32',
  }[service])

export {
  serviceIdToLogo16,
  serviceIdToLogo14,
  serviceIdToIconFont,
  serviceIdToAccentColor,
  inactiveServiceAccentColor,
}
