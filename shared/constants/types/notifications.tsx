import * as I from 'immutable'
import {Tab} from '../tabs'

export type NotificationKeys = 'kbfsUploading' | 'outOfSpace'
export type BadgeType = 'regular' | 'update' | 'error' | 'uploading'

export type _State = {
  desktopAppBadgeCount: number
  keyState: I.Map<NotificationKeys, boolean>
  mobileAppBadgeCount: number
  navBadges: I.Map<Tab, number>
  badgeVersion: number
  widgetBadge: BadgeType
}
export type State = I.RecordOf<_State>
