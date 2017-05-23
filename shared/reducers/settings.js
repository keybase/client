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
    groups: {
      email: {
        settings: null,
        unsubscribedFromAll: false,
      },
    },
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
      if (!state.notifications.groups.email) {
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

      let changed = {}
      console.warn('name is', name, 'group is', group)
      if (group) {
        const {settings, unsubscribedFromAll} = state.notifications.groups[group]
        changed[group] = {
          settings: settings.map(s => updateSubscribe(s, group)),
          unsubscribedFromAll: !name && !unsubscribedFromAll,
        }
      }
      return {
        ...state,
        notifications: {
          ...state.notifications,
          allowSave: true,
          groups: {
            ...state.notifications.groups,
            ...changed,
          },
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
          allowEdit: true,
          allowSave: false,
          groups: {
            ...action.payload,
          },
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
