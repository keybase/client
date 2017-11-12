// @flow
import * as I from 'immutable'
import type {Tab} from './tabs'

export type NotificationKeys = 'kbfsUploading'
export type BadgeType = 'regular' | 'update' | 'badged' | 'uploading'

type _State = {
  desktopAppBadgeCount: number,
  keyState: I.Map<NotificationKeys, boolean>,
  mobileAppBadgeCount: number,
  navBadges: I.Map<Tab, number>,
  widgetBadge: BadgeType,
}
export type State = I.RecordOf<_State>

export const makeState: I.RecordFactory<_State> = I.Record({
  desktopAppBadgeCount: 0,
  keyState: I.Map(),
  mobileAppBadgeCount: 0,
  navBadges: I.Map(),
  widgetBadge: 'regular',
})
