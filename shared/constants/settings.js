// @flow
import type {NoErrorTypedAction} from '../constants/types/flux'

export const notificationsRefresh = 'settings:notificationsRefresh'
export type NotificationsRefresh = NoErrorTypedAction<'settings:notificationsRefresh', void>
export const notificationsRefreshed = 'settings:notificationsRefreshed'
export type NotificationsRefreshed = NoErrorTypedAction<'settings:notificationsRefreshed', NotificationsState>

export const notificationsSave = 'settings:notificationsSave'
export type NotificationsSave = NoErrorTypedAction<'settings:notificationsSave', void>
export const notificationsSaved = 'settings:notificationsSaved'
export type NotificationsSaved = NoErrorTypedAction<'settings:notificationsSaved', void>

export const notificationsToggle = 'settings:notificationsToggle'
export type NotificationsToggle = NoErrorTypedAction<'settings:notificationsToggle', {name: ?string}>

export type PlanLevel = 'Basic' | 'Gold' | 'Friend'
export const plans: Array<PlanLevel> = ['Basic', 'Gold', 'Friend']

export type PaymentInfo = {
  name: string,
  last4Digits: string,
  isBroken: boolean,
}

export type Actions = NotificationsRefresh | NotificationsRefreshed | NotificationsSave | NotificationsSaved | NotificationsToggle

export type NotificationsState = {
  settings: ?Array<{
    name: string,
    subscribed: boolean,
    description: string,
  }>,
  unsubscribedFromAll: ?boolean,
  allowSave: boolean,
}

export type State = {
  notifications: NotificationsState,
}
