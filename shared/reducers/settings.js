// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/settings'
import HiddenString from '../util/hidden-string'

import type {Actions, State} from '../constants/settings'

const initialState: State = {
  allowDeleteAccount: false,
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
    errorMessage: null,
  },
  passphrase: {
    newPassphrase: new HiddenString(''),
    newPassphraseConfirm: new HiddenString(''),
    showTyping: false,
    errorMessage: null,
    newPassphraseError: null,
    newPassphraseConfirmError: null,
    hasPGPKeyOnServer: null,
    canSave: false,
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
          canSave: _canSave(action.payload.passphrase, state.passphrase.newPassphraseConfirm, state.passphrase.hasPGPKeyOnServer !== null),
          errorMessage: null,
        },
      }
    case Constants.onChangeNewPassphraseConfirm:
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          newPassphraseConfirm: action.payload.passphrase,
          canSave: _canSave(state.passphrase.newPassphrase, action.payload.passphrase, state.passphrase.hasPGPKeyOnServer !== null),
          errorMessage: null,
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
          errorMessage: action.payload.error,
        },
      }
    case Constants.onChangeShowPassphrase:
      return {
        ...state,
        passphrase: {
          ...state.passphrase,
          showTyping: !state.passphrase.showTyping,
        },
      }
    case Constants.onChangeNewEmail:
      return {
        ...state,
        email: {
          ...state.email,
          newEmail: action.payload.email,
          errorMessage: null,
        },
      }
    case Constants.onUpdateEmailError:
      return {
        ...state,
        email: {
          ...state.email,
          errorMessage: action.payload.error,
        },
      }
  }
  return state
}

function _canSave (one: HiddenString, two: HiddenString, downloadedPGPState: boolean): boolean {
  return downloadedPGPState && one.stringValue() === two.stringValue() && one.stringValue().length >= 12
}

export default reducer
