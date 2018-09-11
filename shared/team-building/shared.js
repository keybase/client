// @flow
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

export {serviceIdToLogo16, serviceIdToLogo14}
