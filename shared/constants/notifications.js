// @flow
import * as I from 'immutable'
import type {_State} from './types/notifications'

export const makeState: I.RecordFactory<_State> = I.Record({
  desktopAppBadgeCount: 0,
  keyState: I.Map(),
  mobileAppBadgeCount: 0,
  navBadges: I.Map(),
  widgetBadge: 'regular',
})
