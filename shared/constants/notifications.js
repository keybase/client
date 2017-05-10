// @flow
import {Map, Record} from 'immutable'

import type {LogLevel, BadgeState} from '../constants/types/flow-types'
import type {Tab} from './tabs'
import type {TypedAction, NoErrorTypedAction} from '../constants/types/flux'

export type NotificationKeys = 'kbfsUploading'
export type BadgeType = 'regular' | 'update' | 'badged' | 'uploading'

export type LogAction = TypedAction<
  'notifications:log',
  {level: LogLevel, text: string},
  void
>
export type BadgeAppAction = NoErrorTypedAction<
  'notifications:badgeApp',
  {key: NotificationKeys, on: boolean, count?: number}
>
export type ReceivedBadgeState = NoErrorTypedAction<
  'notifications:receivedBadgeState',
  {badgeState: BadgeState}
>
export type ListenForNotifications = NoErrorTypedAction<
  'notifications:listenForNotifications',
  void
>
export type ListenForKBFSNotifications = NoErrorTypedAction<
  'notifications:listenForKBFSNotifications',
  void
>

export type Actions =
  | LogAction
  | BadgeAppAction
  | ListenForNotifications
  | ReceivedBadgeState

export type State = Record<{
  desktopAppBadgeCount: number,
  keyState: Map<NotificationKeys, boolean>,
  mobileAppBadgeCount: number,
  navBadges: Map<Tab, number>,
  widgetBadge: BadgeType,
}>

export const StateRecord = Record({
  desktopAppBadgeCount: 0,
  keyState: Map(),
  mobileAppBadgeCount: 0,
  navBadges: Map(),
  widgetBadge: 'regular',
})
