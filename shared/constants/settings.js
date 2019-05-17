// @flow
import * as Types from './types/settings'
import HiddenString from '../util/hidden-string'
import type {TypedState} from './reducer'
import * as I from 'immutable'
import * as WaitingConstants from './waiting'
import {getMeta} from './chat2/meta'

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

export const makeFeedback: I.RecordFactory<Types._FeedbackState> = I.Record({
  error: null,
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
  feedback: makeFeedback(),
  invites: makeInvites(),
  lockdownModeEnabled: null,
  notifications: makeNotifications(),
  password: makePassword(),
  useNativeFrame: true,
  waitingForResponse: false,
})

export const getExtraChatLogsForLogSend = (state: Object) => {
  const chat = state.chat2
  const c = state.chat2.selectedConversation
  if (c) {
    const metaMap: Object = getMeta(state, c).toJS()
    return I.Map({
      badgeMap: chat.badgeMap.get(c),
      editingMap: chat.editingMap.get(c),
      messageMap: chat.messageMap.get(c, I.Map()).map(m => ({
        a: m.author,
        i: m.id,
        o: m.ordinal,
        out: (m.type === 'text' || m.type === 'attachment') && m.outboxID,
        s: (m.type === 'text' || m.type === 'attachment') && m.submitState,
        t: m.type,
      })),
      messageOrdinals: chat.messageOrdinals.get(c),
      metaMap: {
        channelname: 'x',
        conversationIDKey: metaMap.conversationIDKey,
        description: 'x',
        inboxVersion: metaMap.inboxVersion,
        isMuted: metaMap.isMuted,
        membershipType: metaMap.membershipType,
        notificationsDesktop: metaMap.notificationsDesktop,
        notificationsGlobalIgnoreMentions: metaMap.notificationsGlobalIgnoreMentions,
        notificationsMobile: metaMap.notificationsMobile,
        offline: metaMap.offline,
        participants: 'x',
        rekeyers: metaMap.rekeyers && metaMap.rekeyers.size,
        resetParticipants: metaMap.resetParticipants && metaMap.resetParticipants.size,
        retentionPolicy: metaMap.retentionPolicy,
        snippet: 'x',
        snippetDecoration: 'x',
        supersededBy: metaMap.supersededBy,
        supersedes: metaMap.supersedes,
        teamRetentionPolicy: metaMap.teamRetentionPolicy,
        teamType: metaMap.teamType,
        teamname: metaMap.teamname,
        timestamp: metaMap.timestamp,
        tlfname: metaMap.tlfname,
        trustedState: metaMap.trustedState,
        wasFinalizedBy: metaMap.wasFinalizedBy,
      },
      pendingOutboxToOrdinal: chat.pendingOutboxToOrdinal.get(c),
      quote: chat.quote,
      unreadMap: chat.unreadMap.get(c),
    }).toJS()
  }
  return {}
}

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
export const sendFeedbackWaitingKey = 'settings:sendFeedback'
