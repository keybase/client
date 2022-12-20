import type {Tab} from '../tabs'

export type NotificationKeys = 'kbfsUploading' | 'outOfSpace'
export type BadgeType = 'regular' | 'update' | 'error' | 'uploading'

export type State = {
  desktopAppBadgeCount: number
  keyState: Map<NotificationKeys, boolean>
  mobileAppBadgeCount: number
  navBadges: Map<Tab, number>
  badgeVersion: number
  widgetBadge: BadgeType
}
