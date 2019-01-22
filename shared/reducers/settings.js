// @flow
import logger from '../logger'
import * as SettingsGen from '../actions/settings-gen'
import * as Types from '../constants/types/settings'
import * as Constants from '../constants/settings'
import * as Flow from '../util/flow'

function reducer(state: Types.State = Constants.initialState, action: SettingsGen.Actions): Types.State {
  switch (action.type) {
    case SettingsGen.resetStore:
      return {...Constants.initialState}
    case SettingsGen.setAllowDeleteAccount:
      const {allow} = action.payload
      return {
        ...Constants.initialState,
        allowDeleteAccount: allow,
      }
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
      return {
        ...state,
        notifications: {
          ...state.notifications,
          allowEdit: false,
          groups: {
            ...state.notifications.groups,
            ...changed,
          },
        },
      }
    case SettingsGen.notificationsSaved:
      return {
        ...state,
        notifications: {
          ...state.notifications,
          allowEdit: true,
        },
      }
    case SettingsGen.notificationsRefreshed:
      const {notifications} = action.payload
      return {
        ...state,
        notifications: {
          allowEdit: true,
          groups: {
            ...notifications,
          },
        },
      }
    case SettingsGen.invitesRefreshed:
      const {invites} = action.payload
      return {
        ...state,
        invites: {
          ...state.invites,
          ...invites,
        },
      }
    case SettingsGen.invitesSent:
      // TODO this doesn't do anything with the actual valid payload
      return {
        ...state,
        invites: {
          ...state.invites,
          error: action.error ? action.payload.error : undefined,
        },
      }
    case SettingsGen.invitesClearError:
      return {
        ...state,
        invites: {
          ...state.invites,
          error: null,
        },
      }
    case SettingsGen.loadedSettings: {
      return {
        ...state,
        email: {
          ...state.email,
          emails: action.payload.emails || [],
        },
      }
    }
    case SettingsGen.loadedRememberPassphrase:
    case SettingsGen.onChangeRememberPassphrase:
      const {remember} = action.payload
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          rememberPassphrase: remember,
        },
      }
    case SettingsGen.onChangeNewPassphrase:
      const {passphrase} = action.payload
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          error: null,
          newPassphrase: passphrase,
        },
      }
    case SettingsGen.loadedLockdownMode:
      const {status} = action.payload
      return {
        ...state,
        lockdownModeEnabled: status,
      }
    case SettingsGen.onChangeNewPassphraseConfirm: {
      const {passphrase} = action.payload
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          error: null,
          newPassphraseConfirm: passphrase,
        },
      }
    }
    case SettingsGen.onUpdatedPGPSettings:
      const {hasKeys} = action.payload
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          hasPGPKeyOnServer: hasKeys,
        },
      }
    case SettingsGen.onUpdatePassphraseError:
      const {error} = action.payload
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          error,
        },
      }
    case SettingsGen.onChangeNewEmail:
      const {email} = action.payload
      return {
        ...state,
        email: {
          ...state.email,
          error: null,
          newEmail: email,
        },
      }
    case SettingsGen.onUpdateEmailError: {
      const {error} = action.payload
      return {
        ...state,
        email: {
          ...state.email,
          error,
        },
      }
    }
    case SettingsGen.waitingForResponse:
      const {waiting} = action.payload
      return {
        ...state,
        waitingForResponse: waiting,
      }
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
      const {randomPW} = action.payload
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          randomPW,
        },
      }
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
