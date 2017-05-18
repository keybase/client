// @flow
import type {IconType} from '../common-adapters/icon'

const services: {[service: string]: true} = {
  'Hacker News': true,
  Facebook: true,
  GitHub: true,
  Keybase: true,
  Reddit: true,
  Twitter: true,
}

export type Service = $Keys<typeof services>

const serviceToIcon16: {[service: Service]: IconType} = {
  Facebook: 'icon-facebook-logo-16',
  GitHub: 'icon-github-logo-16',
  'Hacker News': 'icon-hacker-news-logo-16',
  Keybase: 'icon-keybase-logo-16',
  Reddit: 'icon-reddit-logo-16',
  Twitter: 'icon-twitter-logo-16',
}

const serviceToIcon24: {[service: Service]: IconType} = {
  Facebook: 'icon-facebook-logo-24',
  GitHub: 'icon-github-logo-24',
  'Hacker News': 'icon-hacker-news-logo-24',
  Keybase: 'icon-keybase-logo-24',
  Reddit: 'icon-reddit-logo-24',
  Twitter: 'icon-twitter-logo-24',
}

const serviceToIcon16BW: {[service: Service]: IconType} = {
  Facebook: 'iconfont-identity-facebook',
  GitHub: 'iconfont-identity-github',
  'Hacker News': 'iconfont-identity-hn',
  Keybase: 'iconfont-shh',
  Reddit: 'iconfont-identity-reddit',
  Twitter: 'iconfont-identity-twitter',
}

// TODO cecile will make images for everything
const serviceToIcon24BW: {[service: Service]: IconType} = {
  Facebook: 'iconfont-identity-facebook',
  GitHub: 'iconfont-identity-github',
  'Hacker News': 'iconfont-identity-hn',
  Keybase: 'iconfont-shh',
  Reddit: 'iconfont-identity-reddit',
  Twitter: 'iconfont-identity-twitter',
}

export {serviceToIcon16, serviceToIcon16BW, serviceToIcon24, serviceToIcon24BW}
