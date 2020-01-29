import * as Styles from '../styles'
import {ServiceIdWithContact, ServiceMap} from '../constants/types/team-building'
import {IconType} from '../common-adapters/icon.constants-gen'
import {allServices} from '../constants/team-building'

const Kb = {IconType}

const serviceColors: {[K in ServiceIdWithContact]: string} = {
  get email() {
    return Styles.isDarkMode() ? '#3663ea' : '#3663ea'
  },
  get facebook() {
    return Styles.isDarkMode() ? '#3B5998' : '#3B5998'
  },
  get github() {
    return Styles.isDarkMode() ? '#E7E8E8' : '#333'
  },
  get hackernews() {
    return Styles.isDarkMode() ? '#FF6600' : '#FF6600'
  },
  get keybase() {
    return Styles.isDarkMode() ? '#3663ea' : '#3663ea'
  },
  get phone() {
    return Styles.isDarkMode() ? '#3663ea' : '#3663ea'
  },
  get reddit() {
    return Styles.isDarkMode() ? '#ff4500' : '#ff4500'
  },
  get twitter() {
    return Styles.isDarkMode() ? '#1DA1F2' : '#1DA1F2'
  },
}

const services: {
  [K in ServiceIdWithContact]: {
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
    icon: Kb.IconType.iconfont_mention,
    label: 'Email', // TODO: rethink this for the empty state when we're actually using it
    longLabel: ['An email', 'address'],
    searchPlaceholder: 'email',
  },
  facebook: {
    icon: Kb.IconType.iconfont_identity_facebook,
    label: 'Facebook',
    longLabel: ['A Facebook', 'user'],
    searchPlaceholder: 'Facebook',
  },
  github: {
    icon: Kb.IconType.iconfont_identity_github,
    label: 'GitHub',
    longLabel: ['A GitHub', 'user'],
    searchPlaceholder: 'GitHub',
  },
  hackernews: {
    icon: Kb.IconType.iconfont_identity_hn,
    label: 'Hacker News',
    longLabel: ['A Hacker', 'News user'],
    searchPlaceholder: 'Hacker News',
  },
  keybase: {
    avatarIcon: Styles.isMobile
      ? Kb.IconType.icon_placeholder_avatar_circular_48
      : Kb.IconType.icon_placeholder_avatar_circular_32,
    icon: Kb.IconType.iconfont_contact_book,
    label: 'Keybase and contacts',
    longLabel: Styles.isMobile ? ['Keybase &', 'Contacts'] : ['A Keybase', 'user'],
    searchPlaceholder: Styles.isMobile ? 'Keybase & contacts' : 'Keybase',
  },
  phone: {
    badge: true,
    icon: Kb.IconType.iconfont_number_pad,
    label: 'Phone',
    longLabel: ['A phone', 'number'],
    searchPlaceholder: 'phone',
  },
  reddit: {
    icon: Kb.IconType.iconfont_identity_reddit,
    label: 'Reddit',
    longLabel: ['A Reddit', 'user'],
    searchPlaceholder: 'Reddit',
  },
  twitter: {
    icon: Kb.IconType.iconfont_identity_twitter,
    label: 'Twitter',
    longLabel: ['A Twitter', 'user'],
    searchPlaceholder: 'Twitter',
  },
}

export const serviceIdToAccentColor = (service: ServiceIdWithContact): string => serviceColors[service]
export const serviceIdToIconFont = (service: ServiceIdWithContact): IconType => services[service].icon
export const serviceIdToAvatarIcon = (service: ServiceIdWithContact): IconType =>
  services[service].avatarIcon || services[service].icon
export const serviceIdToLabel = (service: ServiceIdWithContact): string => services[service].label
export const serviceIdToLongLabel = (service: ServiceIdWithContact): Array<string> =>
  services[service].longLabel
export const serviceIdToSearchPlaceholder = (service: ServiceIdWithContact): string =>
  services[service].searchPlaceholder
export const serviceIdToBadge = (service: ServiceIdWithContact): boolean => services[service].badge === true

export const serviceMapToArray = (services: ServiceMap) =>
  allServices.filter(x => x !== 'keybase' && x in services)
