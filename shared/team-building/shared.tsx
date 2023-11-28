import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import type {IconType} from '@/common-adapters/icon.constants-gen'
import {allServices} from '@/constants/team-building'

const serviceColors: {[K in T.TB.ServiceIdWithContact]: string} = {
  get email() {
    return Kb.Styles.isDarkMode() ? '#3663ea' : '#3663ea'
  },
  get facebook() {
    return Kb.Styles.isDarkMode() ? '#3B5998' : '#3B5998'
  },
  get github() {
    return Kb.Styles.isDarkMode() ? '#E7E8E8' : '#333'
  },
  get hackernews() {
    return Kb.Styles.isDarkMode() ? '#FF6600' : '#FF6600'
  },
  get keybase() {
    return Kb.Styles.isDarkMode() ? '#3663ea' : '#3663ea'
  },
  get phone() {
    return Kb.Styles.isDarkMode() ? '#3663ea' : '#3663ea'
  },
  get reddit() {
    return Kb.Styles.isDarkMode() ? '#ff4500' : '#ff4500'
  },
  get twitter() {
    return Kb.Styles.isDarkMode() ? '#1DA1F2' : '#1DA1F2'
  },
}

const services: {
  [K in T.TB.ServiceIdWithContact]: {
    avatarIcon?: IconType // icon to show as avatar for results, if different than `icon`
    badge?: boolean
    icon: IconType // icon to show in tab bar
    label: string
    longLabel: Array<string>
    searchPlaceholder: string
  }
} = {
  email: {
    badge: true,
    icon: 'iconfont-mention',
    label: 'Email', // TODO: rethink this for the empty state when we're actually using it
    longLabel: ['An email', 'address'],
    searchPlaceholder: 'email',
  },
  facebook: {
    icon: 'iconfont-identity-facebook',
    label: 'Facebook',
    longLabel: ['A Facebook', 'user'],
    searchPlaceholder: 'Facebook',
  },
  github: {
    icon: 'iconfont-identity-github',
    label: 'GitHub',
    longLabel: ['A GitHub', 'user'],
    searchPlaceholder: 'GitHub',
  },
  hackernews: {
    icon: 'iconfont-identity-hn',
    label: 'Hacker News',
    longLabel: ['A Hacker', 'News user'],
    searchPlaceholder: 'Hacker News',
  },
  keybase: {
    avatarIcon: Kb.Styles.isMobile
      ? 'icon-placeholder-avatar-circular-48'
      : 'icon-placeholder-avatar-circular-32',
    icon: 'iconfont-contact-book',
    label: 'Keybase and contacts',
    longLabel: Kb.Styles.isMobile ? ['Keybase &', 'Contacts'] : ['A Keybase', 'user'],
    searchPlaceholder: Kb.Styles.isMobile ? 'Keybase & contacts' : 'Keybase',
  },
  phone: {
    badge: true,
    icon: 'iconfont-number-pad',
    label: 'Phone',
    longLabel: ['A phone', 'number'],
    searchPlaceholder: 'phone',
  },
  reddit: {
    icon: 'iconfont-identity-reddit',
    label: 'Reddit',
    longLabel: ['A Reddit', 'user'],
    searchPlaceholder: 'Reddit',
  },
  twitter: {
    icon: 'iconfont-identity-twitter',
    label: 'Twitter',
    longLabel: ['A Twitter', 'user'],
    searchPlaceholder: 'Twitter',
  },
}

export const serviceIdToAccentColor = (service: T.TB.ServiceIdWithContact): string => serviceColors[service]
export const serviceIdToIconFont = (service: T.TB.ServiceIdWithContact): IconType => services[service].icon
export const serviceIdToAvatarIcon = (service: T.TB.ServiceIdWithContact): IconType =>
  services[service].avatarIcon || services[service].icon
export const serviceIdToLabel = (service: T.TB.ServiceIdWithContact): string => services[service].label
export const serviceIdToLongLabel = (service: T.TB.ServiceIdWithContact): Array<string> =>
  services[service].longLabel
export const serviceIdToSearchPlaceholder = (service: T.TB.ServiceIdWithContact): string =>
  services[service].searchPlaceholder
export const serviceIdToBadge = (service: T.TB.ServiceIdWithContact): boolean =>
  services[service].badge === true

export const serviceMapToArray = (services: T.TB.ServiceMap) =>
  allServices.filter(x => x !== 'keybase' && x in services)
