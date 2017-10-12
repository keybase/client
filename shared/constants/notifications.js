// @flow
import * as I from 'immutable'

import type {LogLevel, BadgeState} from '../constants/types/flow-types'
import type {Tab} from './tabs'
import type {TypedAction, NoErrorTypedAction} from '../constants/types/flux'

export type NotificationKeys = 'kbfsUploading'
export type BadgeType = 'regular' | 'update' | 'badged' | 'uploading'

export type LogAction = TypedAction<'notifications:log', {level: LogLevel, text: string}, void>
export type BadgeAppAction = NoErrorTypedAction<
  'notifications:badgeApp',
  {key: NotificationKeys, on: boolean, count?: number}
>
export type ReceivedBadgeState = NoErrorTypedAction<
  'notifications:receivedBadgeState',
  {badgeState: BadgeState}
>
export type ListenForNotifications = NoErrorTypedAction<'notifications:listenForNotifications', void>
export type ListenForKBFSNotifications = NoErrorTypedAction<'notifications:listenForKBFSNotifications', void>

export type Actions = LogAction | BadgeAppAction | ListenForNotifications | ReceivedBadgeState

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
