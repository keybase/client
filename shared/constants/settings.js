// @flow
import type {NoErrorTypedAction, TypedAction} from '../constants/types/flux'

export const invitesReclaim = 'settings:invitesReclaim'
export type InvitesReclaim = NoErrorTypedAction<'settings:invitesReclaim', {inviteId: string}>

export const invitesReclaimed = 'settings:invitesReclaimed'
export type InvitesReclaimed = TypedAction<'settings:invitesReclaimed', void, {errorText: string}>

export const invitesRefresh = 'settings:invitesRefresh'
export type InvitesRefresh = NoErrorTypedAction<'settings:invitesRefresh', void>
export const invitesRefreshed = 'settings:invitesRefreshed'
export type InvitesRefreshed = NoErrorTypedAction<'settings:invitesRefreshed', InvitesState>

export const invitesSend = 'settings:invitesSend'
export type InvitesSend = NoErrorTypedAction<'settings:invitesSend', {
  email: string,
  message: ?string,
}>

export const invitesSent = 'settings:invitesSent'
export type InvitesSent = TypedAction<'settings:invitesSent', {email: string}, {errorText: string}>

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

export const setAllowDeleteAccount = 'settings:setAllowDeleteAccount'
export type SetAllowDeleteAccount = NoErrorTypedAction<'settings:setAllowDeleteAccount', boolean>

export const deleteAccountForever = 'settings:deleteAccountForever'
export type DeleteAccountForever = NoErrorTypedAction<'settings:deleteAccountForever', void>

export type PlanLevel = 'Basic' | 'Gold' | 'Friend'
const plans: Array<PlanLevel> = ['Basic', 'Gold', 'Friend']

export type Actions = InvitesRefresh | NotificationsRefresh | NotificationsRefreshed | NotificationsSave | NotificationsSaved | NotificationsToggle | SetAllowDeleteAccount

export type Invitation = {
  created: number,
  email: string,
  id: string,
  type: string,
  username?: string,
  uid?: string,
  url: string,
}

export type InvitesState = {
  pendingInvites: Array<Invitation>,
  acceptedInvites: Array<Invitation>,
}

export type NotificationsState = {
  settings: ?Array<{
    name: string,
    subscribed: boolean,
    description: string,
  }>,
  unsubscribedFromAll: ?boolean,
  allowSave: boolean,
  allowEdit: boolean,
}

export type State = {
  allowDeleteAccount: boolean,
  invites: InvitesState,
  notifications: NotificationsState,
}

const levelToPrice: {[key: PlanLevel]: string} = {
  'Basic': 'Free',
  'Gold': '$7/mo',
  'Friend': '$9/mo',
}

const levelToPriceLong: {[key: PlanLevel]: string} = {
  'Basic': 'Free',
  'Gold': '$7/month',
  'Friend': '$9/month',
}

const levelToStars: {[key: PlanLevel]: number} = {
  'Basic': 1,
  'Gold': 3,
  'Friend': 5,
}

const levelToSpace: {[key: PlanLevel]: string} = {
  'Basic': '10GB',
  'Gold': '50GB',
  'Friend': '250GB',
}

function levelToDetails (p: PlanLevel) {
  return `You will be able to use up to ${levelToSpace[p]} of data.`
}

// Compare weather another plan is an upgrade, downgrade or the same
// -1 : otherLevel is a downgrade from level
// 0 : otherLevel is the same as level
// 1 : otherLevel is an upgrade from level
function comparePlans (level: PlanLevel, otherLevel: PlanLevel): -1 | 0 | 1 {
  const levelIndex = plans.indexOf(level)
  const otherLevelIndex = plans.indexOf(otherLevel)
  if (levelIndex === otherLevelIndex) return 0
  if (levelIndex < otherLevelIndex) return 1
  if (levelIndex > otherLevelIndex) return -1

  // make flow happy
  return 0
}

export {
  comparePlans,
  levelToDetails,
  levelToPrice,
  levelToPriceLong,
  levelToSpace,
  levelToStars,
  plans,
}
