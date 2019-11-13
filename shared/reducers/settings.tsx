import logger from '../logger'
import * as SettingsGen from '../actions/settings-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Types from '../constants/types/settings'
import * as Constants from '../constants/settings'
import {isValidEmail} from '../util/simple-validators'

const initialState: Types.State = Constants.makeState()

type Actions =
  | SettingsGen.Actions
  | EngineGen.Keybase1NotifyEmailAddressEmailsChangedPayload
  | EngineGen.Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload

  export default makeReducer<Actions, Types.State>(initialState, {
      [ SettingsGen.resetStore]: () => initialState,
      [ SettingsGen.notificationsToggle]: (draftState, action) => {
      if (!draftState.notifications.groups.get('email')) {
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

      const groupMap = draftState.notifications.groups.get(group) ?? Constants.makeNotificationsGroup()
      const {settings, unsubscribedFromAll} = groupMap
      if (!settings) {
        logger.warn('Trying to toggle unknown settings')
        return 
      }

      draftState.notifications.allowEdit = false
      draftState.notifications.groups.set(group, {
          settings: settings.map(s => updateSubscribe(s, group)),
          // No name means toggle the unsubscribe option
          unsubscribedFromAll: !name && !unsubscribedFromAll,
      })
    },
    [ SettingsGen.notificationsSaved]: (draftState, action) => {
      return state.update('notifications', notifications => notifications.merge({allowEdit: true}))
      [ SettingsGen.notificationsRefreshed]: (draftState, action) => {
      return state.update('notifications', notifications =>
        notifications.merge({
          allowEdit: true,
          groups: action.payload.notifications,
        })
      )
      [ SettingsGen.invitesRefreshed]: (draftState, action) => {
      return state.update('invites', invites => invites.merge(action.payload.invites))
      [ SettingsGen.invitesSent]: (draftState, action) => {
      return state.update('invites', invites => invites.merge({error: action.payload.error}))
      [ SettingsGen.invitesClearError]: (draftState, action) => {
      return state.update('invites', invites => invites.merge({error: null}))
      [ SettingsGen.loadedSettings]: (draftState, action) => {
      return state
        .setIn(['email', 'emails'], action.payload.emails)
        .setIn(['phoneNumbers', 'phones'], action.payload.phones)
        [ EngineGen.keybase1NotifyEmailAddressEmailsChanged]: (draftState, action) => {
      return state.setIn(
        ['email', 'emails'],
        I.Map((action.payload.params.list || []).map(row => [row.email, Constants.makeEmailRow(row)]))
      )
      [ SettingsGen.emailVerified]: (draftState, action) => {
      return state
        .updateIn(
          ['email', 'emails'],
          emails =>
            emails
              ? emails.update(action.payload.email, (email: any) =>
                  email
                    ? email.merge({
                        isVerified: true,
                      })
                    : undefined
                )
              : undefined // unclear what we want to do here
        )
        .update('email', emailState => emailState.merge({addedEmail: null}))
        [ EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged]: (draftState, action) => {
      return state.setIn(
        ['phoneNumbers', 'phones'],
        I.Map((action.payload.params.list || []).map(row => [row.phoneNumber, Constants.toPhoneRow(row)]))
      )
      [ SettingsGen.loadedRememberPassword]: (draftState, action) => { // fallthrough<<<<
          [ SettingsGen.onChangeRememberPassword]: (draftState, action) => {
      return state.update('password', password => password.merge({rememberPassword: action.payload.remember}))
      [ SettingsGen.onChangeNewPassword]: (draftState, action) => {
      return state.update('password', password =>
        password.merge({error: null, newPassword: action.payload.password})
      )
      [ SettingsGen.loadedLockdownMode]: (draftState, action) => {
      return state.merge({lockdownModeEnabled: action.payload.status})
      [ SettingsGen.loadedProxyData]: (draftState, action) => {
      return state.merge({proxyData: action.payload.proxyData})
      [ SettingsGen.certificatePinningToggled]: (draftState, action) => {
      return state.merge({didToggleCertificatePinning: action.payload.toggled})
      [ SettingsGen.onChangeNewPasswordConfirm]: (draftState, action) => {
      return state.update('password', password =>
        password.merge({error: null, newPasswordConfirm: action.payload.password})
      )
      [ SettingsGen.checkPassword]: (draftState, action) => {
      return state.merge({checkPasswordIsCorrect: null})
      [ SettingsGen.onUpdatedPGPSettings]: (draftState, action) => {
      return state.update('password', password => password.merge({hasPGPKeyOnServer: action.payload.hasKeys}))
      [ SettingsGen.onUpdatePasswordError]: (draftState, action) => {
      return state.update('password', password => password.merge({error: action.payload.error}))
      [ SettingsGen.onChangeNewEmail]: (draftState, action) => {
      return state.update('email', email => email.merge({error: '', newEmail: action.payload.email}))
      [ SettingsGen.onUpdateEmailError]: (draftState, action) => {
      return state.update('email', email => email.merge({error: action.payload.error.message}))
      [ SettingsGen.feedbackSent]: (draftState, action) => {
      return state.update('feedback', feedback => feedback.set('error', action.payload.error))
      [ SettingsGen.sendFeedback]: (draftState, action) => {
          return state.update('feedback', feedback => feedback.set('error', null)) // 
          [ SettingsGen.unfurlSettingsRefreshed]: (draftState, action) => { // fallthrough
              [ SettingsGen.unfurlSettingsSaved]: (draftState, action) => {
      return state.merge({
        chat: state.chat.merge({
          unfurl: Constants.makeUnfurl({
            unfurlError: undefined,
            unfurlMode: action.payload.mode,
            unfurlWhitelist: action.payload.whitelist,
          }),
        }),
      })
      [ SettingsGen.unfurlSettingsError]: (draftState, action) => {
      return state.merge({
        chat: state.chat.merge({unfurl: state.chat.unfurl.merge({unfurlError: action.payload.error})}),
      })
      [ SettingsGen.loadedHasRandomPw]: (draftState, action) => {
      return state.update('password', password => password.merge({randomPW: action.payload.randomPW}))
      [ SettingsGen.loadedCheckPassword]: (draftState, action) => {
      return state.merge({checkPasswordIsCorrect: action.payload.checkPasswordIsCorrect})
      [ SettingsGen.addedPhoneNumber]: (draftState, action) => {
      return state.update('phoneNumbers', pn =>
        pn.merge({
          error: action.payload.error || '',
          pendingVerification: action.payload.phoneNumber,
          verificationState: null,
        })
      )
      [ SettingsGen.resendVerificationForPhoneNumber]: (draftState, action) => {
      return state.update('phoneNumbers', pn =>
        pn.merge({error: '', pendingVerification: action.payload.phoneNumber, verificationState: null})
      )
      [ SettingsGen.clearPhoneNumberErrors]: (draftState, action) => {
      return state.update('phoneNumbers', pn => pn.merge({error: ''}))
      [ SettingsGen.clearPhoneNumberAdd]: (draftState, action) => {
      return state.update('phoneNumbers', pn =>
        pn.merge({
          error: '',
          pendingVerification: '',
          verificationState: null,
        })
      )
      [ SettingsGen.verifiedPhoneNumber]: (draftState, action) => {
      if (action.payload.phoneNumber !== state.phoneNumbers.pendingVerification) {
        logger.warn("Got verifiedPhoneNumber but number doesn't match")
        return state
      }
      return state.update('phoneNumbers', pn =>
        pn.merge({
          addedPhone: !action.payload.error,
          error: action.payload.error,
          verificationState: action.payload.error ? 'error' : 'success',
        })
      )
      [ SettingsGen.loadedContactImportEnabled]: (draftState, action) => {
      return state.update('contacts', contacts => contacts.merge({importEnabled: action.payload.enabled}))
      [ SettingsGen.loadedContactPermissions]: (draftState, action) => {
      return state.update('contacts', contacts => contacts.merge({permissionStatus: action.payload.status}))
      [ SettingsGen.setContactImportedCount]: (draftState, action) => {
      return state.update('contacts', contacts =>
        contacts.merge({importError: action.payload.error, importedCount: action.payload.count})
      )
      [ SettingsGen.importContactsLater]: (draftState, action) => {
      return state.update('contacts', contacts => contacts.set('importPromptDismissed', true))
      [ SettingsGen.loadedUserCountryCode]: (draftState, action) => {
      return state.update('contacts', contacts => contacts.set('userCountryCode', action.payload.code))
      [ SettingsGen.addEmail]: (draftState, action) => {
      const {email} = action.payload
      const emailError = isValidEmail(email)
      return state.update('email', emailState => emailState.merge({addingEmail: email, error: emailError}))
    }
    [ SettingsGen.addedEmail]: (draftState, action) => {
      if (action.payload.email !== state.email.addingEmail) {
        logger.warn("addedEmail: doesn't match")
        return state
      }
      return state.update('email', emailState =>
        emailState.merge({
          addedEmail: action.payload.error ? null : action.payload.email,
          addingEmail: action.payload.error ? emailState.addingEmail : null,
          error: action.payload.error || '',
        })
      )
    }
    [ SettingsGen.sentVerificationEmail]: (draftState, action) => {
      return state.update('email', emailState =>
        emailState.merge({
          addedEmail: action.payload.email,
          emails: (emailState.emails || I.Map<string, Types.EmailRow>()).update(
            action.payload.email,
            (email = Constants.makeEmailRow({email: action.payload.email, isVerified: false})) =>
              email.merge({
                lastVerifyEmailDate: new Date().getTime() / 1000,
              })
          ),
        })
      )
    }
    [ SettingsGen.clearAddingEmail]: (draftState, action) => {
      return state.update('email', emailState => emailState.merge({addingEmail: null, error: ''}))
    }
    [ SettingsGen.clearAddedEmail]: (draftState, action) => {
      return state.update('email', emailState => emailState.merge({addedEmail: null}))
    }
    [ SettingsGen.clearAddedPhone]: (draftState, action) => {
      return state.mergeIn(['phoneNumbers'], {addedPhone: false})
    }
  }
}
