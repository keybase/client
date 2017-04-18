// @flow
import type {LogLevel, BadgeState} from '../constants/types/flow-types'
import type {TypedAction, NoErrorTypedAction} from '../constants/types/flux'
import {Map, Record} from 'immutable'

export type NotificationKeys = 'newTLFs' | 'kbfsUploading' | 'chatInbox'
export type MenuStateKeys = 'chatBadge' | 'deviceBadge' | 'folderBadge' | 'peopleBadge'
export type BadgeType = 'regular' | 'update' | 'badged' | 'uploading'

export type LogAction = TypedAction<'notifications:log', {level: LogLevel, text: string}, void>
export type BadgeAppAction = NoErrorTypedAction<'notifications:badgeApp', {key: NotificationKeys, on: boolean, count?: number}>
export type ReceivedBadgeState = NoErrorTypedAction<'notifications:receivedBadgeState', {badgeState: BadgeState}>
export type ListenForNotifications = NoErrorTypedAction<'notifications:listenForNotifications', void>
export type ListenForKBFSNotifications = NoErrorTypedAction<'notifications:listenForKBFSNotifications', void>

export type Actions = LogAction | BadgeAppAction | ListenForNotifications | ReceivedBadgeState

export type State = Record<{
  keyState: Map<NotificationKeys, boolean>,
  menuBadgeCount: number,
  menuNotifications: Map<MenuStateKeys, number>,
  mobileAppBadgeCount: number,
  widgetBadge: BadgeType,
}>

export const StateRecord = Record({
  keyState: Map(),
  menuBadgeCount: 0,
  menuNotifications: Map(),
  mobileAppBadgeCount: 0,
  widgetBadge: 'regular',
})
