import * as C from '.'
import * as T from './types'
import * as Z from '@/util/zustand'

export const contactSettingsSaveWaitingKey = 'settings:contactSettingsSaveWaitingKey'
export const chatUnfurlWaitingKey = 'settings:chatUnfurlWaitingKey'
export const contactSettingsLoadWaitingKey = 'settings:contactSettingsLoadWaitingKey'

export type ChatUnfurlState = {
  unfurlMode?: T.RPCChat.UnfurlMode
  unfurlWhitelist?: Array<string>
  unfurlError?: string
}

export type ContactSettingsState = {
  error: string
  settings?: T.RPCGen.ContactSettings
}

export type ContactSettingsTeamsList = {[k in T.RPCGen.TeamID]: boolean}

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
    unfurlSettingsSaved: (mode: T.RPCChat.UnfurlMode, whitelist: Array<string>) => void
    resetState: 'default'
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    contactSettingsRefresh: () => {
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          return
        }
        try {
          const settings = await T.RPCGen.accountUserGetContactSettingsRpcPromise(
            undefined,
            contactSettingsLoadWaitingKey
          )
          set(s => {
            s.contactSettings = {error: '', settings}
          })
        } catch (_) {
          set(s => {
            s.contactSettings.error = 'Unable to load contact settings, please try again.'
          })
        }
      }
      C.ignorePromise(f())
    },
    contactSettingsSaved: (enabled, indirectFollowees, teamsEnabled, teamsList) => {
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
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
          await T.RPCGen.accountUserSetContactSettingsRpcPromise({settings}, contactSettingsSaveWaitingKey)
          get().dispatch.contactSettingsRefresh()
        } catch {
          set(s => {
            s.contactSettings.error = 'Unable to save contact settings, please try again.'
          })
        }
      }
      C.ignorePromise(f())
    },
    resetState: 'default',
    unfurlSettingsRefresh: () => {
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          return
        }
        try {
          const result = await T.RPCChat.localGetUnfurlSettingsRpcPromise(undefined, chatUnfurlWaitingKey)
          set(s => {
            s.unfurl = {
              unfurlError: undefined,
              unfurlMode: result.mode,
              unfurlWhitelist: result.whitelist ?? [],
            }
          })
        } catch (_) {
          set(s => {
            s.unfurl.unfurlError = 'Unable to load link preview settings, please try again.'
          })
        }
      }
      C.ignorePromise(f())
    },
    unfurlSettingsSaved: (unfurlMode, unfurlWhitelist) => {
      set(s => {
        s.unfurl = {unfurlError: undefined, unfurlMode, unfurlWhitelist}
      })
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          return
        }
        try {
          await T.RPCChat.localSaveUnfurlSettingsRpcPromise(
            {mode: unfurlMode, whitelist: unfurlWhitelist},
            chatUnfurlWaitingKey
          )
          get().dispatch.unfurlSettingsRefresh()
        } catch (_) {
          set(s => {
            s.unfurl.unfurlError = 'Unable to save link preview settings, please try again.'
          })
        }
      }
      C.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
