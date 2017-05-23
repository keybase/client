// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/settings'
import HiddenString from '../util/hidden-string'

import type {Actions, State} from '../constants/settings'

const initialState: State = {
  allowDeleteAccount: false,
  email: {
    emails: [],
    error: null,
    newEmail: '',
  },
  invites: {
    acceptedInvites: [],
    error: null,
    pendingInvites: [],
  },
  notifications: {
    allowEdit: false,
    allowSave: false,
    settings: {
      email: null,
      app_push: null,
    },
    unsubscribedFromAll: null,
  },
  passphrase: {
    error: null,
    hasPGPKeyOnServer: null,
    newPassphrase: new HiddenString(''),
    newPassphraseConfirm: new HiddenString(''),
    newPassphraseConfirmError: null,
    newPassphraseError: null,
  },
  push: {
    permissionsPrompt: false,
    permissionsRequesting: false,
    token: '',
    tokenType: '',
  },
  waitingForResponse: false,
}

function reducer(state: State = initialState, action: Actions): State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.setAllowDeleteAccount:
      return {
        ...initialState,
        allowDeleteAccount: action.payload,
      }
    case Constants.notificationsToggle:
      if (!state.notifications.emailSettings) {
        console.log('Warning: trying to toggle while not loaded')
        return state
      } else if (!state.notifications.allowEdit) {
        console.log('Warning: trying to toggle while allowEdit false')
        return state
      }

      console.warn('in notificationsToggle reducer', action.payload)
      // No name means the unsubscribe option
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

      return {
        ...state,
        notifications: {
          ...state.notifications,
          allowSave: true,
          settings: {
            email: state.notifications.settings.email.map(s => updateSubscribe(s, 'email')),
            app_push: state.notifications.settings.app_push.map(s => updateSubscribe(s, 'app_push')),
	  },
          unsubscribedFromAll: name ? false : !state.notifications.unsubscribedFromAll,
        },
      }
    case Constants.notificationsSave:
      return {
        ...state,
        notifications: {
          ...state.notifications,
          allowEdit: false,
        },
      }
    case Constants.notificationsSaved:
      return {
        ...state,
        notifications: {
          ...state.notifications,
          allowEdit: true,
          allowSave: false,
        },
      }
    case Constants.notificationsRefreshed:
      return {
        ...state,
        notifications: {
          ...action.payload,
          allowEdit: true,
          allowSave: false,
        },
      }
    case Constants.invitesRefreshed:
      return {
        ...state,
        invites: {
          ...state.invites,
          ...action.payload,
        },
      }
    case Constants.invitesSent:
      return {
        ...state,
        invites: {
          ...state.invites,
          error: action.payload.error,
        },
      }
    case 'invites:clearError':
      return {
        ...state,
        invites: {
          ...state.invites,
          error: null,
        },
      }
    case Constants.loadedSettings: {
      return {
        ...state,
        email: {
          ...action.payload,
        },
      }
    }
    case Constants.onChangeNewPassphrase:
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          error: null,
          newPassphrase: action.payload.passphrase,
        },
      }
    case Constants.onChangeNewPassphraseConfirm:
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          error: null,
          newPassphraseConfirm: action.payload.passphrase,
        },
      }
    case Constants.onUpdatedPGPSettings:
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          hasPGPKeyOnServer: action.payload.hasKeys,
        },
      }
    case Constants.onUpdatePassphraseError:
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          error: action.payload.error,
        },
      }
    case Constants.onChangeNewEmail:
      return {
        ...state,
        email: {
          ...state.email,
          error: null,
          newEmail: action.payload.email,
        },
      }
    case Constants.onUpdateEmailError:
      return {
        ...state,
        email: {
          ...state.email,
          error: action.payload.error,
        },
      }
    case Constants.waitingForResponse:
      return {
        ...state,
        waitingForResponse: action.payload,
      }
  }
  return state
}

export default reducer
