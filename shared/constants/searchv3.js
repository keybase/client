// @flow
import type {IconType} from '../common-adapters/icon'

const services: {[service: string]: true} = {
  Facebook: true,
  GitHub: true,
  'Hacker News': true,
  Keybase: true,
  Reddit: true,
  Twitter: true,
}

export type Service = $Keys<typeof services>

const serviceToIcon16: {[service: Service]: IconType} = {
  Facebook: 'icon-search-facebook-active-16',
  GitHub: 'icon-search-github-active-16',
  'Hacker News': 'icon-search-hacker-news-active-16',
  Keybase: 'icon-search-keybase-active-16',
  Reddit: 'icon-search-reddit-active-16',
  Twitter: 'icon-search-twitter-active-16',
}

const serviceToIcon24: {[service: Service]: IconType} = {
  Facebook: 'icon-search-facebook-active-24',
  GitHub: 'icon-search-github-active-24',
  'Hacker News': 'icon-search-hacker-news-active-24',
  Keybase: 'icon-search-keybase-active-24',
  Reddit: 'icon-search-reddit-active-24',
  Twitter: 'icon-search-twitter-active-24',
}

const serviceToIcon16BW: {[service: Service]: IconType} = {
  Facebook: 'icon-search-facebook-inactive-16',
  GitHub: 'icon-search-github-inactive-16',
  'Hacker News': 'icon-search-hacker-news-inactive-16',
  Keybase: 'icon-search-keybase-inactive-16',
  Reddit: 'icon-search-reddit-inactive-16',
  Twitter: 'icon-search-twitter-inactive-16',
}

const serviceToIcon24BW: {[service: Service]: IconType} = {
  Facebook: 'icon-search-facebook-inactive-24',
  GitHub: 'icon-search-github-inactive-24',
  'Hacker News': 'icon-search-hacker-news-inactive-24',
  Keybase: 'icon-search-keybase-inactive-24',
  Reddit: 'icon-search-reddit-inactive-24',
  Twitter: 'icon-search-twitter-inactive-24',
}

export {serviceToIcon16, serviceToIcon16BW, serviceToIcon24, serviceToIcon24BW}
