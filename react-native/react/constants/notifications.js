/* @flow */
import type {LogLevel} from '../constants/types/flow-types'
import type {TypedAction} from '../constants/types/flux'

// Actions
export const log = 'notifications:log'
export type LogAction = TypedAction<'notifications:log', {level: LogLevel, text: string}, void>

export type NotificationAction = LogAction
