// @flow
import * as Types from './types/settings'
import HiddenString from '../util/hidden-string'
import type {TypedState} from './reducer'
import * as I from 'immutable'
import * as WaitingConstants from './waiting'

export const makeNotifications: I.RecordFactory<Types.NotificationsState> = I.Record({
  allowEdit: false,
  groups: I.Map(),
})

export const makeNotificationsGroup: I.RecordFactory<Types.NotificationsGroupState> = I.Record({
  settings: I.Map(),
  unsubscribedFromAll: false,
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  allowDeleteAccount: false,
  chat: {
    unfurl: {},
  },
  checkPassphraseIsCorrect: null,
  email: {
    emails: null,
    error: null,
    newEmail: '',
  },
  invites: {
    acceptedInvites: I.List(),
    error: null,
    pendingInvites: I.List(),
  },
  lockdownModeEnabled: null,
  notifications: makeNotifications(),
  passphrase: {
    error: null,
    hasPGPKeyOnServer: null,
    newPassphrase: new HiddenString(''),
    newPassphraseConfirm: new HiddenString(''),
    newPassphraseConfirmError: null,
    newPassphraseError: null,
    randomPW: null,
    rememberPassphrase: true,
  },
  waitingForResponse: false,
})

export const traceInProgressKey = 'traceInProgress'
export const traceInProgress = (state: TypedState) => WaitingConstants.anyWaiting(state, traceInProgressKey)
export const processorProfileInProgressKey = 'processorProfileInProgress'
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
export const passphraseTab = 'settingsTabs.passphrase'
export const refreshNotificationsWaitingKey = 'settingsTabs.refreshNotifications'
export const screenprotectorTab = 'settingsTabs.screenprotector'
export const updatePaymentTab = 'settingsTabs.updatePaymentTab'
export const securityGroup = 'security'
export const walletsTab = 'settingsTabs.walletsTab'

export const chatUnfurlWaitingKey = 'settings:chatUnfurlWaitingKey'
export const setLockdownModeWaitingKey = 'settings:setLockdownMode'
export const loadLockdownModeWaitingKey = 'settings:loadLockdownMode'
export const checkPassphraseWaitingKey = 'settings:checkPassphrase'
export const dontUseWaitingKey = 'settings:settingsPage'
