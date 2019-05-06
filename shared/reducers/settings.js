// @flow
import logger from '../logger'
import * as I from 'immutable'
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
      if (!state.notifications.groups.get('email')) {
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
          groups: state.notifications.groups.merge(I.Map(changed)),
        })
      )
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
        invites.merge({error: action.error ? action.payload.error : undefined})
      )
    case SettingsGen.invitesClearError:
      return state.update('invites', invites => invites.merge({error: null}))
    case SettingsGen.loadedSettings:
      return state.set('email', Constants.makeEmail({emails: action.payload.emails}))
    case SettingsGen.loadedRememberPassword:
    case SettingsGen.onChangeRememberPassword:
      return state.update('password', password => password.merge({rememberPassword: action.payload.remember}))
    case SettingsGen.onChangeNewPassword:
      return state.update('password', password =>
        password.merge({error: null, newPassword: action.payload.password})
      )
    case SettingsGen.loadedLockdownMode:
      return state.merge({lockdownModeEnabled: action.payload.status})
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
    case SettingsGen.waitingForResponse:
      return state.merge({waitingForResponse: action.payload.waiting})
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
    // Saga only actions
    case SettingsGen.dbNuke:
    case SettingsGen.deleteAccountForever:
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
      return state
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action)
      return state
  }
}

export default reducer
