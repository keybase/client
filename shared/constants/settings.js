// @flow
import * as Types from './types/settings'
import HiddenString from '../util/hidden-string'
import type {TypedState} from './reducer'
import * as I from 'immutable'
import * as WaitingConstants from './waiting'

export const makeNotificationsGroup: I.RecordFactory<Types._NotificationsGroupState> = I.Record({
  settings: I.List(),
  unsubscribedFromAll: false,
})

export const makeNotifications: I.RecordFactory<Types._NotificationsState> = I.Record({
  allowEdit: false,
  groups: I.Map(),
})

export const makeUnfurl: I.RecordFactory<Types._ChatUnfurlState> = I.Record({
  unfurlError: undefined,
  unfurlMode: null,
  unfurlWhitelist: I.List(),
})

export const makeChat: I.RecordFactory<Types._ChatState> = I.Record({
  unfurl: makeUnfurl(),
})

export const makeEmail: I.RecordFactory<Types._EmailState> = I.Record({
  emails: null,
  error: null,
  newEmail: '',
})

export const makeEmailRow: I.RecordFactory<Types._EmailRow> = I.Record({
  email: '',
  isPrimary: false,
  isVerified: false,
  visibility: 0,
})

export const makeInvites: I.RecordFactory<Types._InvitesState> = I.Record({
  acceptedInvites: I.List(),
  error: null,
  pendingInvites: I.List(),
})

export const makePassword: I.RecordFactory<Types._PasswordState> = I.Record({
  error: null,
  hasPGPKeyOnServer: null,
  newPassword: new HiddenString(''),
  newPasswordConfirm: new HiddenString(''),
  newPasswordConfirmError: null,
  newPasswordError: null,
  randomPW: null,
  rememberPassword: true,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  allowDeleteAccount: false,
  chat: makeChat(),
  checkPasswordIsCorrect: null,
  email: makeEmail(),
  invites: makeInvites(),
  lockdownModeEnabled: null,
  notifications: makeNotifications(),
  password: makePassword(),
  waitingForResponse: false,
})

export const traceInProgressKey = 'settings:traceInProgress'
export const traceInProgress = (state: TypedState) => WaitingConstants.anyWaiting(state, traceInProgressKey)
export const processorProfileInProgressKey = 'settings:processorProfileInProgress'
export const processorProfileInProgress = (state: TypedState) =>
  WaitingConstants.anyWaiting(state, processorProfileInProgressKey)

export const aboutTab = 'settingsTabs.aboutTab'
export const advancedTab = 'settingsTabs.advancedTab'
export const chatTab = 'settingsTabs.chatTab'
export const deleteMeTab = 'settingsTabs.deleteMeTab'
export const devicesTab = 'settingsTabs.devicesTab'
export const feedbackTab = 'settingsTabs.feedbackTab'
export const foldersTab = 'settingsTabs.foldersTab'
export const fsTab = 'settingsTabs.fsTab'
export const gitTab = 'settingsTabs.gitTab'
export const invitationsTab = 'settingsTabs.invitationsTab'
export const landingTab = 'settingsTabs.landingTab'
export const logOutTab = 'settingsTabs.logOutTab'
export const notificationsTab = 'settingsTabs.notificationsTab'
export const passwordTab = 'settingsTabs.password'
export const refreshNotificationsWaitingKey = 'settingsTabs.refreshNotifications'
export const screenprotectorTab = 'settingsTabs.screenprotector'
export const updatePaymentTab = 'settingsTabs.updatePaymentTab'
export const securityGroup = 'security'
export const walletsTab = 'settingsTabs.walletsTab'

export const chatUnfurlWaitingKey = 'settings:chatUnfurlWaitingKey'
export const setLockdownModeWaitingKey = 'settings:setLockdownMode'
export const loadLockdownModeWaitingKey = 'settings:loadLockdownMode'
export const checkPasswordWaitingKey = 'settings:checkPassword'
export const dontUseWaitingKey = 'settings:settingsPage'
