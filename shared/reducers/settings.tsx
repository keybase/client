import logger from '../logger'
import * as I from 'immutable'
import * as SettingsGen from '../actions/settings-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import * as Types from '../constants/types/settings'
import * as Constants from '../constants/settings'
import * as Flow from '../util/flow'
import {actionHasError} from '../util/container'
import {isValidEmail} from '../util/simple-validators'

const initialState: Types.State = Constants.makeState()

type Actions =
  | SettingsGen.Actions
  | EngineGen.Keybase1NotifyEmailAddressEmailsChangedPayload
  | EngineGen.Keybase1NotifyEmailAddressEmailAddressVerifiedPayload
  | EngineGen.Keybase1NotifyPhoneNumberPhoneNumbersChangedPayload

function reducer(state: Types.State = initialState, action: Actions): Types.State {
  switch (action.type) {
    case SettingsGen.resetStore:
      return initialState
    case SettingsGen.setAllowDeleteAccount:
      return state.merge({allowDeleteAccount: action.payload.allow})
    case SettingsGen.notificationsToggle: {
      if (!state.notifications.groups.get('email')) {
        logger.warn('Trying to toggle while not loaded')
        return state
      } else if (!state.notifications.allowEdit) {
        logger.warn('Trying to toggle while allowEdit false')
        return state
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

      const groupMap = state.notifications.groups.get(group) || Constants.makeNotificationsGroup()
      const {settings, unsubscribedFromAll} = groupMap
      if (!settings) {
        logger.warn('Trying to toggle unknown settings')
        return state
      }
      const changed = {
        [group]: {
          settings: settings.map(s => updateSubscribe(s, group)),
          // No name means toggle the unsubscribe option
          unsubscribedFromAll: !name && !unsubscribedFromAll,
        },
      }
      return state.update('notifications', notifications =>
        notifications.merge({
          allowEdit: false,
          groups: state.notifications.groups.merge(I.Map(changed)) as any,
        })
      )
    }
    case SettingsGen.notificationsSaved:
      return state.update('notifications', notifications => notifications.merge({allowEdit: true}))
    case SettingsGen.notificationsRefreshed:
      return state.update('notifications', notifications =>
        notifications.merge({
          allowEdit: true,
          groups: action.payload.notifications,
        })
      )
    case SettingsGen.invitesRefreshed:
      return state.update('invites', invites => invites.merge(action.payload.invites))
    case SettingsGen.invitesSent:
      // TODO this doesn't do anything with the actual valid payload
      return state.update('invites', invites =>
        invites.merge({error: actionHasError(action) ? action.payload.error : undefined})
      )
    case SettingsGen.invitesClearError:
      return state.update('invites', invites => invites.merge({error: null}))
    case SettingsGen.loadedSettings:
      return state
        .setIn(['email', 'emails'], action.payload.emails)
        .setIn(['phoneNumbers', 'phones'], action.payload.phones)
    case EngineGen.keybase1NotifyEmailAddressEmailsChanged:
      return state.setIn(
        ['email', 'emails'],
        I.Map((action.payload.params.list || []).map(row => [row.email, Constants.makeEmailRow(row)]))
      )
    case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
      return state
        .updateIn(
          ['email', 'emails'],
          emails =>
            emails
            ? emails.update(action.payload.params.emailAddress, (email: any) =>
                  email
                    ? email.merge({
                        isVerified: true,
                      })
                    : undefined
                )
              : undefined // unclear what we want to do here
        )
        .update('email', emailState => emailState.merge({addedEmail: null}))
    case EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged:
      return state.setIn(
        ['phoneNumbers', 'phones'],
        I.Map((action.payload.params.list || []).map(row => [row.phoneNumber, Constants.toPhoneRow(row)]))
      )
    case SettingsGen.loadedRememberPassword:
    case SettingsGen.onChangeRememberPassword:
      return state.update('password', password => password.merge({rememberPassword: action.payload.remember}))
    case SettingsGen.onChangeNewPassword:
      return state.update('password', password =>
        password.merge({error: null, newPassword: action.payload.password})
      )
    case SettingsGen.loadedLockdownMode:
      return state.merge({lockdownModeEnabled: action.payload.status})
    case SettingsGen.loadedProxyData:
      return state.merge({proxyData: action.payload.proxyData})
    case SettingsGen.certificatePinningToggled:
      return state.merge({didToggleCertificatePinning: action.payload.toggled})
    case SettingsGen.onChangeNewPasswordConfirm:
      return state.update('password', password =>
        password.merge({error: null, newPasswordConfirm: action.payload.password})
      )
    case SettingsGen.checkPassword:
      return state.merge({checkPasswordIsCorrect: null})
    case SettingsGen.onUpdatedPGPSettings:
      return state.update('password', password => password.merge({hasPGPKeyOnServer: action.payload.hasKeys}))
    case SettingsGen.onUpdatePasswordError:
      return state.update('password', password => password.merge({error: action.payload.error}))
    case SettingsGen.onChangeNewEmail:
      return state.update('email', email => email.merge({error: null, newEmail: action.payload.email}))
    case SettingsGen.onUpdateEmailError:
      return state.update('email', email => email.merge({error: action.payload.error}))
    case SettingsGen.feedbackSent:
      return state.update('feedback', feedback => feedback.set('error', action.payload.error))
    case SettingsGen.sendFeedback:
      return state.update('feedback', feedback => feedback.set('error', null))
    case SettingsGen.unfurlSettingsRefreshed:
    case SettingsGen.unfurlSettingsSaved:
      return state.merge({
        chat: state.chat.merge({
          unfurl: Constants.makeUnfurl({
            unfurlError: undefined,
            unfurlMode: action.payload.mode,
            unfurlWhitelist: action.payload.whitelist,
          }),
        }),
      })
    case SettingsGen.unfurlSettingsError:
      return state.merge({
        chat: state.chat.merge({unfurl: state.chat.unfurl.merge({unfurlError: action.payload.error})}),
      })
    case SettingsGen.loadedHasRandomPw:
      return state.update('password', password => password.merge({randomPW: action.payload.randomPW}))
    case SettingsGen.loadedCheckPassword:
      return state.merge({checkPasswordIsCorrect: action.payload.checkPasswordIsCorrect})
    case SettingsGen.onChangeUseNativeFrame:
      return state.merge({useNativeFrame: action.payload.enabled})
    case SettingsGen.addedPhoneNumber:
      return state.update('phoneNumbers', pn =>
        pn.merge({
          error: action.payload.error || '',
          pendingVerification: action.payload.phoneNumber,
          verificationState: null,
        })
      )
    case SettingsGen.resendVerificationForPhoneNumber:
      return state.update('phoneNumbers', pn =>
        pn.merge({error: '', pendingVerification: action.payload.phoneNumber, verificationState: null})
      )
    case SettingsGen.clearPhoneNumberErrors:
      return state.update('phoneNumbers', pn => pn.merge({error: ''}))
    case SettingsGen.clearPhoneNumberAdd:
      return state.update('phoneNumbers', pn =>
        pn.merge({
          error: '',
          pendingVerification: '',
          verificationState: null,
        })
      )
    case SettingsGen.verifiedPhoneNumber:
      if (action.payload.phoneNumber !== state.phoneNumbers.pendingVerification) {
        logger.warn("Got verifiedPhoneNumber but number doesn't match")
        return state
      }
      return state.update('phoneNumbers', pn =>
        pn.merge({error: action.payload.error, verificationState: action.payload.error ? 'error' : 'success'})
      )
    case SettingsGen.loadedContactImportEnabled:
      return state.update('contacts', contacts => contacts.merge({importEnabled: action.payload.enabled}))
    case SettingsGen.loadedContactPermissions:
      return state.update('contacts', contacts => contacts.merge({permissionStatus: action.payload.status}))
    case SettingsGen.setContactImportedCount:
      return state.update('contacts', contacts => contacts.set('importedCount', action.payload.count))
    case SettingsGen.importContactsLater:
      return state.update('contacts', contacts => contacts.set('importPromptDismissed', true))
    case SettingsGen.loadedUserCountryCode:
      return state.update('contacts', contacts => contacts.set('userCountryCode', action.payload.code))
    case SettingsGen.addEmail: {
      const {email} = action.payload
      const emailError = isValidEmail(email)
      return state.update('email', emailState =>
        emailState.merge({addingEmail: email, error: emailError ? new Error(emailError) : null})
      )
    }
    case SettingsGen.addedEmail: {
      if (action.payload.email !== state.email.addingEmail) {
        logger.warn("addedEmail: doesn't match")
        return state
      }
      return state.update('email', emailState =>
        emailState.merge({
          addedEmail: action.payload.error ? null : action.payload.email,
          addingEmail: action.payload.error ? emailState.addingEmail : null,
          error: action.payload.error || null,
        })
      )
    }
    case SettingsGen.sentVerificationEmail: {
      return state.update('email', emailState =>
        emailState.merge({
          addedEmail: action.payload.email,
        })
      )
    }
    case SettingsGen.clearAddingEmail: {
      return state.update('email', emailState => emailState.merge({addingEmail: null, error: null}))
    }
    case SettingsGen.clearAddedEmail: {
      return state.update('email', emailState => emailState.merge({addedEmail: null}))
    }
    // Saga only actions
    case SettingsGen.dbNuke:
    case SettingsGen.deleteAccountForever:
    case SettingsGen.editEmail:
    case SettingsGen.editPhone:
    case SettingsGen.invitesReclaim:
    case SettingsGen.invitesReclaimed:
    case SettingsGen.invitesRefresh:
    case SettingsGen.invitesSend:
    case SettingsGen.loadRememberPassword:
    case SettingsGen.loadSettings:
    case SettingsGen.loadLockdownMode:
    case SettingsGen.notificationsRefresh:
    case SettingsGen.onChangeShowPassword:
    case SettingsGen.onSubmitNewEmail:
    case SettingsGen.onSubmitNewPassword:
    case SettingsGen.onUpdatePGPSettings:
    case SettingsGen.onChangeLockdownMode:
    case SettingsGen.stop:
    case SettingsGen.trace:
    case SettingsGen.processorProfile:
    case SettingsGen.unfurlSettingsRefresh:
    case SettingsGen.loadHasRandomPw:
    case SettingsGen.addPhoneNumber:
    case SettingsGen.verifyPhoneNumber:
    case SettingsGen.loadProxyData:
    case SettingsGen.saveProxyData:
    case SettingsGen.loadContactImportEnabled:
    case SettingsGen.editContactImportEnabled:
    case SettingsGen.requestContactPermissions:
    case SettingsGen.toggleRuntimeStats:
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}

export default reducer
