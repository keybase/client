// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/settings'
import HiddenString from '../util/hidden-string'

import type {Actions, State} from '../constants/settings'

const initialState: State = {
  allowDeleteAccount: false,
  waitingForResponse: false,
  invites: {
    pendingInvites: [],
    acceptedInvites: [],
  },
  notifications: {
    settings: null,
    unsubscribedFromAll: null,
    allowSave: false,
    allowEdit: false,
  },
  email: {
    emails: [],
    newEmail: '',
    error: null,
  },
  passphrase: {
    newPassphrase: new HiddenString(''),
    newPassphraseConfirm: new HiddenString(''),
    error: null,
    newPassphraseError: null,
    newPassphraseConfirmError: null,
    hasPGPKeyOnServer: null,
  },
  push: {
    permissionsPrompt: false,
    permissionsRequesting: false,
    tokenType: '',
    token: '',
  },
}

function reducer (state: State = initialState, action: Actions): State {
  switch (action.type) {
    case CommonConstants.resetStore:
      return {...initialState}
    case Constants.setAllowDeleteAccount:
      return {
        ...initialState,
        allowDeleteAccount: action.payload,
      }
    case Constants.notificationsToggle:
      if (!state.notifications.settings) {
        console.log('Warning: trying to toggle while not loaded')
        return state
      } else if (!state.notifications.allowEdit) {
        console.log('Warning: trying to toggle while allowEdit false')
        return state
      }

      // No name means the unsubscribe option
      const name = action.payload.name

      const updateSubscribe = setting => {
        let subscribed = setting.subscribed

        if (!name) { // clicked unsub all
          subscribed = false
        } else if (name === setting.name) { // flip if its the one we're looking for
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
          settings: state.notifications.settings.map(updateSubscribe),
          unsubscribedFromAll: name ? false : !state.notifications.unsubscribedFromAll,
          allowSave: true,
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
          allowSave: false,
          allowEdit: true,
        },
      }
    case Constants.notificationsRefreshed:
      return {
        ...state,
        notifications: {
          ...action.payload,
          allowSave: false,
          allowEdit: true,
        },
      }
    case Constants.invitesRefreshed:
      return {
        ...state,
        invites: {
          ...action.payload,
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
          newPassphrase: action.payload.passphrase,
          error: null,
        },
      }
    case Constants.onChangeNewPassphraseConfirm:
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          newPassphraseConfirm: action.payload.passphrase,
          error: null,
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
          newEmail: action.payload.email,
          error: null,
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
