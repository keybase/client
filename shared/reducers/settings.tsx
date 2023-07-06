import logger from '../logger'
import * as SettingsGen from '../actions/settings-gen'
import type * as Types from '../constants/types/settings'
import * as Constants from '../constants/settings'
import * as Container from '../util/container'

const initialState: Types.State = Constants.makeState()

type Actions = SettingsGen.Actions

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

export default Container.makeReducer<Actions, Types.State>(initialState, {
  [SettingsGen.resetStore]: () => initialState,
  ...notificationActions,
  ...chatActions,
})
