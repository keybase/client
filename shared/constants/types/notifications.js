// @flow strict
import * as I from 'immutable'
import type {Tab} from '../tabs'

export type NotificationKeys = 'kbfsUploading' | 'outOfSpace'
export type BadgeType =
  | 'regular'
  | 'update'
  | 'badged'
  | 'error'
  | 'uploading'
  | 'badged-update'
  | 'badged-uploading'
  | 'badged-error'

export type _State = {
  desktopAppBadgeCount: number,
  keyState: I.Map<NotificationKeys, boolean>,
  mobileAppBadgeCount: number,
  navBadges: I.Map<Tab, number>,
  badgeVersion: number,
  widgetBadge: BadgeType,
}
export type State = I.RecordOf<_State>
