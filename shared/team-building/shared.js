// @flow
import type {ServiceIdWithContact} from '../constants/team-building'
import type {IconType} from '../common-adapters/icon.constants'

// TODO
// use 16px version
// use 14px version

const serviceIdToLogo16 = (service: ServiceIdWithContact, isActive: boolean): IconType =>
  ({
    contact: `icon-search-twitter-${isActive ? 'active' : 'inactive'}-32`,
    facebook: `icon-search-facebook-${isActive ? 'active' : 'inactive'}-32`,
    github: `icon-search-github-${isActive ? 'active' : 'inactive'}-32`,
    hackernews: `icon-search-hacker-news-${isActive ? 'active' : 'inactive'}-32`,
    keybase: `icon-search-keybase-${isActive ? 'active' : 'inactive'}-32`,
    pgp: `icon-search-pgp-${isActive ? 'active' : 'inactive'}-32`,
    reddit: `icon-search-reddit-${isActive ? 'active' : 'inactive'}-32`,
    twitter: `icon-search-twitter-${isActive ? 'active' : 'inactive'}-32`,
  }[service])

const serviceIdToLogo14 = (service: ServiceIdWithContact): IconType =>
  ({
    contact: `icon-twitter-logo-32`,
    facebook: `icon-facebook-logo-32`,
    github: `icon-github-logo-32`,
    hackernews: `icon-hacker-news-logo-32`,
    keybase: `icon-keybase-logo-32`,
    pgp: `icon-pgp-logo-32`,
    reddit: `icon-reddit-logo-32`,
    twitter: `icon-twitter-logo-32`,
  }[service])

export {serviceIdToLogo16, serviceIdToLogo14}
