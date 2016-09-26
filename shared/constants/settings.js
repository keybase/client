// @flow
import type {NoErrorTypedAction} from '../constants/types/flux'

export const notificationsRefresh = 'settings:notificationsRefresh'
export type NotificationsRefresh = NoErrorTypedAction<'settings:notificationsRefresh', void>
export const notificationsRefreshed = 'settings:notificationsRefreshed'
export type NotificationsRefreshed = NoErrorTypedAction<'settings:notificationsRefreshed', NotificationsState>

export type PlanLevel = 'Basic' | 'Gold' | 'Friend'
export const plans: Array<PlanLevel> = ['Basic', 'Gold', 'Friend']

export type PaymentInfo = {
  name: string,
  last4Digits: string,
  isBroken: boolean,
}

export type Actions = NotificationsRefresh | NotificationsRefreshed

export type NotificationsState = {
  settings: ?Array<{
    name: string,
    subscribed: boolean,
    description: string,
  }>,
  unsubscribedFromAll: ?boolean,
}

export type State = {
  notifications: NotificationsState,
}
