import type * as RPCChatTypes from './types/rpc-chat-gen'
import * as RPCTypes from './types/rpc-gen'
import {useConfigState} from './config'
import * as Z from '../util/zustand'

export const contactSettingsSaveWaitingKey = 'settings:contactSettingsSaveWaitingKey'

export type ChatUnfurlState = {
  unfurlMode?: RPCChatTypes.UnfurlMode
  unfurlWhitelist?: Array<string>
  unfurlError?: string
}

export type ContactSettingsState = {
  error: string
  settings?: RPCTypes.ContactSettings
}

export type ContactSettingsTeamsList = {[k in RPCTypes.TeamID]: boolean}

type Store = {
  contactSettings: ContactSettingsState
  unfurl: ChatUnfurlState
}

const initialStore: Store = {
  contactSettings: {
    error: '',
    settings: undefined,
  },
  unfurl: {unfurlWhitelist: []},
}

export type State = Store & {
  dispatch: {
    contactSettingsSaved: (
      enabled: boolean,
      indirectFollowees: boolean,
      teamsEnabled: boolean,
      teamsList: ContactSettingsTeamsList
    ) => void
    contactSettingsRefresh: () => void
    unfurlSettingsRefresh: () => void
    unfurlSettingsSaved: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) => void
    resetState: 'default'
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    contactSettingsRefresh: () => {
      // TODO
    },
    unfurlSettingsRefresh: () => {
      // TODO
    },
    unfurlSettingsSaved: (unfurlMode, unfurlWhitelist) => {
      set(s => {
        s.unfurl = {unfurlError: undefined, unfurlMode, unfurlWhitelist}
      })
      // TODO
    },
    contactSettingsSaved: (enabled, indirectFollowees, teamsEnabled, teamsList) => {
      const f = async () => {
        if (!useConfigState.getState().loggedIn) {
          return
        }

        // Convert the selected teams object into the RPC format.
        const teams = Object.entries(teamsList).map(([teamID, enabled]) => ({
          enabled,
          teamID,
        }))
        const allowFolloweeDegrees = indirectFollowees ? 2 : 1
        const settings = {
          allowFolloweeDegrees,
          allowGoodTeams: teamsEnabled,
          enabled,
          teams,
        }
        try {
          await RPCTypes.accountUserSetContactSettingsRpcPromise({settings}, contactSettingsSaveWaitingKey)
          get().dispatch.contactSettingsRefresh()
        } catch {
          set(s => {
            s.contactSettings.error = 'Unable to save contact settings, please try again.'
          })
        }
      }
      Z.ignorePromise(f())
    },
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})

// const chatActions: Container.ActionHandler<Actions, Types.State> = {
//   [SettingsGen.contactSettingsRefreshed]: (draftState, action) => {
//     draftState.chat.contactSettings = {
//       error: '',
//       settings: action.payload.settings,
//     }
//   },
//   [SettingsGen.unfurlSettingsRefreshed]: (draftState, action) => {
//     draftState.chat.unfurl = {
//       unfurlError: undefined,
//       unfurlMode: action.payload.mode,
//       unfurlWhitelist: action.payload.whitelist,
//     }
//   },
//   [SettingsGen.unfurlSettingsError]: (draftState, action) => {
//     draftState.chat.unfurl.unfurlError = action.payload.error
//   },
// }
//
//
//
// "unfurlSettingsRefresh": {
//   "_description": "Refresh unfurl settings"
// },
// "unfurlSettingsRefreshed": {
//   "_description": "Refreshed unfurl settings available",
//   "mode": "RPCChatTypes.UnfurlMode",
//   "whitelist": "Array<string>"
// },
// "unfurlSettingsError": {
//   "_description": "An error occurred on the unfurl settings screen",
//   "error": "string"
// },
// "contactSettingsRefreshed": {
//   "_description": "Refreshed Chat contact settings available",
//   "settings": "RPCTypes.ContactSettings"
// },
// "contactSettingsSaved": {
//   "_description": "Refreshed Chat contact settings available",
//   "enabled": "boolean",
//   "indirectFollowees": "boolean",
//   "teamsEnabled": "boolean",
//   "teamsList": "Types.ContactSettingsTeamsList"
// },
