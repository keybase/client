// @flow
import type {LogLevel} from '../constants/types/flow-types'
import type {TypedAction, NoErrorTypedAction} from '../constants/types/flux'

// Actions
export const log = 'notifications:log'
export type LogAction = TypedAction<'notifications:log', {level: LogLevel, text: string}, void>

export type NotificationKeys = 'newTLFs' | 'kbfsUploading' | 'chatInbox'
export const badgeApp = 'notifications:badgeApp'
export type BadgeAppAction = TypedAction<'notifications:badgeApp', {key: NotificationKeys, on: boolean, count?: number}, void>

export const listenForNotifications = 'notifications:listenForNotifications'
export type ListenForNotifications = NoErrorTypedAction<'notifications:listenForNotifications', void>

export type BadgeType = 'regular' | 'update' | 'badged' | 'uploading'

export type MenuNotificationState = {
  folderBadge: number,
  peopleBadge: number,
  chatBadge: number,
  deviceBadge: number,
}

export type NotificationAction = LogAction | BadgeAppAction | ListenForNotifications
