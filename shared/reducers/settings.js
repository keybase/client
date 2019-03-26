// @flow
import logger from '../logger'
import * as SettingsGen from '../actions/settings-gen'
import * as Types from '../constants/types/settings'
import * as Constants from '../constants/settings'
import * as Flow from '../util/flow'

const initialState: Types.State = Constants.makeState()

function reducer(state: Types.State = initialState, action: SettingsGen.Actions): Types.State {
  switch (action.type) {
    case SettingsGen.resetStore:
      return initialState
    case SettingsGen.setAllowDeleteAccount:
      return state.merge({allowDeleteAccount: action.payload.allow})
    case SettingsGen.notificationsToggle:
      if (!state.notifications.groups.email) {
        logger.warn('Trying to toggle while not loaded')
        return state
      } else if (!state.notifications.allowEdit) {
        logger.warn('Trying to toggle while allowEdit false')
        return state
      }

      const {group, name} = action.payload
      const updateSubscribe = (setting, storeGroup) => {
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

      const {settings, unsubscribedFromAll} = state.notifications.groups[group] || {
        settings: null,
        unsubscribedFromAll: null,
      }
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
      return state.merge({
        notifications: state.notifications.merge({
          allowEdit: false,
          groups: state.notifications.groups.merge({...changed}),
        }),
      })
    case SettingsGen.notificationsSaved:
      return state.merge({notifications: state.notifications.merge({allowEdit: true})})
    case SettingsGen.notificationsRefreshed:
      return state.merge({
        notifications: state.notifications.merge({allowEdit: true, groups: action.payload.notifications}),
      })
    case SettingsGen.invitesRefreshed:
      const {invites} = action.payload
      return state.merge({invites: state.invites.merge(action.payload.invites)})
    case SettingsGen.invitesSent:
      // TODO this doesn't do anything with the actual valid payload
      return state.merge({
        invites: state.invites.merge({error: action.error ? action.payload.error : undefined}),
      })
    case SettingsGen.invitesClearError:
      return state.merge({invites: state.invites.merge({error: null})})
    case SettingsGen.loadedSettings: {
      return state.merge({email: state.email.merge({emails: action.payload.emails || []})})
    }
    case SettingsGen.loadedRememberPassphrase:
    case SettingsGen.onChangeRememberPassphrase:
      return state.merge({passphrase: state.passphrase.merge({rememberPassphrase: action.payload.remember})})
    case SettingsGen.onChangeNewPassphrase:
      return state.merge({
        passphrase: state.passphrase.merge({error: null, newPassphrase: action.payload.passphrase}),
      })
    case SettingsGen.loadedLockdownMode:
      return state.merge({lockdownModeEnabled: action.payload.status})
    case SettingsGen.onChangeNewPassphraseConfirm:
      return state.merge({
        passphrase: state.passphrase.merge({error: null, newPassphraseConfirm: action.payload.passphrase}),
      })
    case SettingsGen.checkPassphrase:
      return state.merge({checkPassphraseIsCorrect: null})
    case SettingsGen.onUpdatedPGPSettings:
      return state.merge({passphrase: state.passphrase.merge({hasPGPKeyOnServer: action.payload.hasKeys})})
    case SettingsGen.onUpdatePassphraseError:
      return state.merge({passphrase: state.passphrase.merge({error: action.payload.error})})
    case SettingsGen.onChangeNewEmail:
      return state.merge({email: state.email.merge({error: null, newEmail: action.payload.email})})
    case SettingsGen.onUpdateEmailError:
      return state.merge({email: state.email.merge({error: action.payload.error})})
    case SettingsGen.waitingForResponse:
      return state.merge({waitingForResponse: action.payload.waiting})
    case SettingsGen.unfurlSettingsRefreshed:
    case SettingsGen.unfurlSettingsSaved:
      const {mode, whitelist} = action.payload
      return {
        ...state,
        chat: {
          ...state.chat,
          unfurl: {
            unfurlError: undefined,
            unfurlMode: mode,
            unfurlWhitelist: whitelist,
          },
        },
      }
    case SettingsGen.unfurlSettingsError:
      return {
        ...state,
        chat: {
          ...state.chat,
          unfurl: {
            ...state.chat.unfurl,
            unfurlError: action.payload.error,
          },
        },
      }
    case SettingsGen.loadedHasRandomPw:
      return state.merge({passphrase: state.passphrase.merge({randomPW: action.payload.randomPW})})
    case SettingsGen.loadedCheckPassphrase:
      const {checkPassphraseIsCorrect} = action.payload
      return state.merge({checkPassphraseIsCorrect})
    // Saga only actions
    case SettingsGen.dbNuke:
    case SettingsGen.deleteAccountForever:
    case SettingsGen.invitesReclaim:
    case SettingsGen.invitesReclaimed:
    case SettingsGen.invitesRefresh:
    case SettingsGen.invitesSend:
    case SettingsGen.loadRememberPassphrase:
    case SettingsGen.loadSettings:
    case SettingsGen.loadLockdownMode:
    case SettingsGen.notificationsRefresh:
    case SettingsGen.onChangeShowPassphrase:
    case SettingsGen.onSubmitNewEmail:
    case SettingsGen.onSubmitNewPassphrase:
    case SettingsGen.onUpdatePGPSettings:
    case SettingsGen.onChangeLockdownMode:
    case SettingsGen.trace:
    case SettingsGen.processorProfile:
    case SettingsGen.unfurlSettingsRefresh:
    case SettingsGen.loadHasRandomPw:
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}

export default reducer
