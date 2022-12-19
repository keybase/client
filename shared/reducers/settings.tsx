import logger from '../logger'
import * as SettingsGen from '../actions/settings-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import type * as Types from '../constants/types/settings'
import * as Constants from '../constants/settings'
import * as Container from '../util/container'
import {isValidEmail} from '../util/simple-validators'

const initialState: Types.State = Constants.makeState()

type Actions =
  | SettingsGen.Actions
  | EngineGen.Keybase1NotifyEmailAddressEmailsChangedPayload
  | EngineGen.Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload

const notificationActions: Container.ActionHandler<Actions, Types.State> = {
  [SettingsGen.notificationsToggle]: (draftState, action) => {
    const {notifications} = draftState
    if (!notifications.groups.get('email')) {
      logger.warn('Trying to toggle while not loaded')
      return
    } else if (!draftState.notifications.allowEdit) {
      logger.warn('Trying to toggle while allowEdit false')
      return
    }

    const {group, name} = action.payload
    const updateSubscribe = (setting: Types.NotificationsSettingsState, storeGroup: string) => {
      let subscribed = setting.subscribed

      if (!name) {
        // clicked unsub all
        subscribed = false
      } else if (name === setting.name && group === storeGroup) {
        // flip if it's the one we're looking for
        subscribed = !subscribed
      }

      return {
        ...setting,
        subscribed,
      }
    }

    const groupMap = notifications.groups.get(group) ?? {
      settings: [],
      unsub: false,
    }

    const {settings, unsub} = groupMap
    if (!settings) {
      logger.warn('Trying to toggle unknown settings')
      return
    }

    notifications.allowEdit = false
    notifications.groups.set(group, {
      settings: settings.map(s => updateSubscribe(s, group)),
      // No name means toggle the unsubscribe option
      unsub: !name && !unsub,
    })
  },
  [SettingsGen.notificationsSaved]: draftState => {
    draftState.notifications.allowEdit = true
  },
  [SettingsGen.notificationsRefreshed]: (draftState, action) => {
    const {notifications} = draftState
    notifications.allowEdit = true
    notifications.groups = action.payload.notifications
  },
}

const invitesActions: Container.ActionHandler<Actions, Types.State> = {
  [SettingsGen.invitesRefreshed]: (draftState, action) => {
    draftState.invites = action.payload.invites
  },
  [SettingsGen.invitesSent]: (draftState, action) => {
    draftState.invites.error = action.payload.error
  },
  [SettingsGen.invitesClearError]: draftState => {
    draftState.invites.error = undefined
  },
}

const emailActions: Container.ActionHandler<Actions, Types.State> = {
  [EngineGen.keybase1NotifyEmailAddressEmailsChanged]: (draftState, action) => {
    const {list} = action.payload.params
    draftState.email.emails = new Map(
      (list || []).map(row => [row.email, {...Constants.makeEmailRow(), ...row}])
    )
  },
  [SettingsGen.emailVerified]: (draftState, action) => {
    const {email} = action.payload
    const map = draftState.email.emails
    const old = map?.get(email)
    if (old) {
      old.isVerified = true
    } else {
      logger.warn('emailVerified on unknown email?')
    }
    draftState.email.addedEmail = undefined
  },
  [EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged]: (draftState, action) => {
    const {list} = action.payload.params
    draftState.phoneNumbers.phones = new Map(
      (list ?? []).map(row => [row.phoneNumber, Constants.toPhoneRow(row)])
    )
  },
  [SettingsGen.onChangeNewEmail]: (draftState, action) => {
    draftState.email.error = ''
    draftState.email.newEmail = action.payload.email
  },
  [SettingsGen.onUpdateEmailError]: (draftState, action) => {
    draftState.email.error = action.payload.error.message
  },
  [SettingsGen.addEmail]: (draftState, action) => {
    const {email} = action.payload
    const emailError = isValidEmail(email)
    draftState.email.addingEmail = email
    draftState.email.error = emailError
  },
  [SettingsGen.addedEmail]: (draftState, action) => {
    const {email} = draftState
    const {error} = action.payload
    if (action.payload.email !== email.addingEmail) {
      logger.warn("addedEmail: doesn't match")
      return
    }
    email.addedEmail = error ? undefined : action.payload.email
    email.addingEmail = error ? email.addingEmail : undefined
    email.error = error || ''
  },
  [SettingsGen.sentVerificationEmail]: (draftState, action) => {
    const {email} = draftState
    email.addedEmail = action.payload.email
    const emails = email.emails || new Map<string, Types.EmailRow>()
    const old = emails.get(action.payload.email) ?? {
      ...Constants.makeEmailRow(),
      email: action.payload.email,
      isVerified: false,
    }
    old.lastVerifyEmailDate = new Date().getTime() / 1000
    emails.set(action.payload.email, old)
    email.emails = emails
  },
  [SettingsGen.clearAddingEmail]: draftState => {
    draftState.email.addingEmail = undefined
    draftState.email.error = ''
  },
  [SettingsGen.clearAddedEmail]: draftState => {
    draftState.email.addedEmail = undefined
  },
}

const passwordActions: Container.ActionHandler<Actions, Types.State> = {
  [SettingsGen.loadedRememberPassword]: (draftState, action) => {
    draftState.password.rememberPassword = action.payload.remember
  },
  [SettingsGen.onChangeRememberPassword]: (draftState, action) => {
    draftState.password.rememberPassword = action.payload.remember
  },
  [SettingsGen.onChangeNewPassword]: (draftState, action) => {
    const {password} = draftState
    password.error = undefined
    password.newPassword = action.payload.password
  },
  [SettingsGen.onChangeNewPasswordConfirm]: (draftState, action) => {
    const {password} = draftState
    password.error = undefined
    password.newPasswordConfirm = action.payload.password
  },
  [SettingsGen.resetCheckPasswordIsCorrect]: draftState => {
    draftState.checkPasswordIsCorrect = undefined
  },
  [SettingsGen.checkPassword]: draftState => {
    draftState.checkPasswordIsCorrect = undefined
  },
  [SettingsGen.onUpdatedPGPSettings]: (draftState, action) => {
    draftState.password.hasPGPKeyOnServer = action.payload.hasKeys
  },
  [SettingsGen.onUpdatePasswordError]: (draftState, action) => {
    draftState.password.error = action.payload.error
  },
  [SettingsGen.loadedHasRandomPw]: (draftState, action) => {
    draftState.password.randomPW = action.payload.randomPW
  },
  [SettingsGen.loadedCheckPassword]: (draftState, action) => {
    draftState.checkPasswordIsCorrect = action.payload.checkPasswordIsCorrect
  },
}

const chatActions: Container.ActionHandler<Actions, Types.State> = {
  [SettingsGen.contactSettingsRefreshed]: (draftState, action) => {
    draftState.chat.contactSettings = {
      error: '',
      settings: action.payload.settings,
    }
  },
  [SettingsGen.contactSettingsError]: (draftState, action) => {
    draftState.chat.contactSettings.error = action.payload.error
  },
  [SettingsGen.unfurlSettingsRefreshed]: (draftState, action) => {
    draftState.chat.unfurl = {
      unfurlError: undefined,
      unfurlMode: action.payload.mode,
      unfurlWhitelist: action.payload.whitelist,
    }
  },
  [SettingsGen.unfurlSettingsSaved]: (draftState, action) => {
    draftState.chat.unfurl = {
      unfurlError: undefined,
      unfurlMode: action.payload.mode,
      unfurlWhitelist: action.payload.whitelist,
    }
  },
  [SettingsGen.unfurlSettingsError]: (draftState, action) => {
    draftState.chat.unfurl.unfurlError = action.payload.error
  },
}

const phoneActions: Container.ActionHandler<Actions, Types.State> = {
  [SettingsGen.addedPhoneNumber]: (draftState, action) => {
    const {phoneNumbers} = draftState
    phoneNumbers.error = action.payload.error || ''
    phoneNumbers.pendingVerification = action.payload.phoneNumber
    phoneNumbers.verificationState = undefined
  },
  [SettingsGen.resendVerificationForPhoneNumber]: (draftState, action) => {
    const {phoneNumbers} = draftState
    phoneNumbers.error = ''
    phoneNumbers.pendingVerification = action.payload.phoneNumber
    phoneNumbers.verificationState = undefined
  },
  [SettingsGen.clearPhoneNumberErrors]: draftState => {
    draftState.phoneNumbers.error = ''
  },
  [SettingsGen.clearPhoneNumberAdd]: draftState => {
    const {phoneNumbers} = draftState
    phoneNumbers.error = ''
    phoneNumbers.pendingVerification = ''
    phoneNumbers.verificationState = undefined
  },
  [SettingsGen.verifiedPhoneNumber]: (draftState, action) => {
    const {phoneNumber, error} = action.payload
    if (phoneNumber !== draftState.phoneNumbers.pendingVerification) {
      logger.warn("Got verifiedPhoneNumber but number doesn't match")
      return
    }
    const {phoneNumbers} = draftState
    phoneNumbers.addedPhone = !error
    phoneNumbers.error = error ?? ''
    phoneNumbers.verificationState = error ? 'error' : 'success'
  },
  [SettingsGen.clearAddedPhone]: draftState => {
    draftState.phoneNumbers.addedPhone = false
  },
}

const contactsActions: Container.ActionHandler<Actions, Types.State> = {
  [SettingsGen.loadedContactImportEnabled]: (draftState, action) => {
    draftState.contacts.importEnabled = action.payload.enabled
  },
  [SettingsGen.loadedContactPermissions]: (draftState, action) => {
    draftState.contacts.permissionStatus = action.payload.status
  },
  [SettingsGen.setContactImportedCount]: (draftState, action) => {
    const {contacts} = draftState
    contacts.importError = action.payload.error ?? ''
    contacts.importedCount = action.payload.count
  },
  [SettingsGen.importContactsLater]: draftState => {
    draftState.contacts.importPromptDismissed = true
  },
  [SettingsGen.loadedUserCountryCode]: (draftState, action) => {
    draftState.contacts.userCountryCode = action.payload.code
  },
  [SettingsGen.showContactsJoinedModal]: (draftState, action) => {
    draftState.contacts.alreadyOnKeybase = action.payload.resolved
    draftState.contacts.waitingToShowJoinedModal = false
  },
  [SettingsGen.editContactImportEnabled]: (draftState, action) => {
    if (action.payload.fromSettings) {
      draftState.contacts.waitingToShowJoinedModal = true
    }
  },
  [SettingsGen.updateDefaultPhoneNumberCountry]: (draftState, action) => {
    draftState.phoneNumbers.defaultCountry = action.payload.country
  },
}

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [SettingsGen.resetStore]: () => initialState,
  [SettingsGen.loadedSettings]: (draftState, action) => {
    const {emails, phones} = action.payload
    draftState.email.emails = emails
    draftState.phoneNumbers.phones = phones
  },
  [SettingsGen.loadedLockdownMode]: (draftState, action) => {
    draftState.lockdownModeEnabled = action.payload.status
  },
  [SettingsGen.loadedProxyData]: (draftState, action) => {
    draftState.proxyData = action.payload.proxyData
  },
  [SettingsGen.certificatePinningToggled]: (draftState, action) => {
    draftState.didToggleCertificatePinning = action.payload.toggled
  },
  [SettingsGen.feedbackSent]: (draftState, action) => {
    draftState.feedback.error = action.payload.error
  },
  [SettingsGen.sendFeedback]: draftState => {
    draftState.feedback.error = undefined
  },
  ...notificationActions,
  ...invitesActions,
  ...emailActions,
  ...passwordActions,
  ...chatActions,
  ...phoneActions,
  ...contactsActions,
})
