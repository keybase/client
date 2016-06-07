/* @flow */
import type {LogLevel} from '../constants/types/flow-types'
import type {TypedAction} from '../constants/types/flux'

// Actions
export const log = 'notifications:log'
export type LogAction = TypedAction<'notifications:log', {level: LogLevel, text: string}, void>
export const badgeApp = 'notifications:badgeApp'

export type NotificationKeys = 'newTLFs'
export type BadgeAppAction = TypedAction<'notifications:badgeApp', {key: NotificationKeys, on: boolean}, void>

export type NotificationAction = LogAction | BadgeAppAction
