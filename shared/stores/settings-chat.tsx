import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import * as S from '@/constants/strings'
import * as Z from '@/util/zustand'
import {useConfigState} from '@/stores/config'

export type ChatUnfurlState = {
  unfurlMode?: T.RPCChat.UnfurlMode
  unfurlWhitelist?: ReadonlyArray<string>
  unfurlError?: string
}

export type ContactSettingsState = {
  error: string
  settings?: T.RPCGen.ContactSettings
}

export type ContactSettingsTeamsList = {[k in T.RPCGen.TeamID]: boolean}

type Store = T.Immutable<{
  contactSettings: ContactSettingsState
  unfurl: ChatUnfurlState
}>

const initialStore: Store = {
  contactSettings: {
    error: '',
    settings: undefined,
  },
  unfurl: {unfurlWhitelist: []},
}

export interface State extends Store {
  dispatch: {
    contactSettingsSaved: (
      enabled: boolean,
      indirectFollowees: boolean,
      teamsEnabled: boolean,
      teamsList: ContactSettingsTeamsList
    ) => void
    contactSettingsRefresh: () => void
    unfurlSettingsRefresh: () => void
    unfurlSettingsSaved: (mode: T.RPCChat.UnfurlMode, whitelist: ReadonlyArray<string>) => void
    resetState: 'default'
  }
}

export const useSettingsChatState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    contactSettingsRefresh: () => {
      const f = async () => {
        if (!useConfigState.getState().loggedIn) {
          return
        }
        try {
          const settings = await T.RPCGen.accountUserGetContactSettingsRpcPromise(undefined)
          set(s => {
            s.contactSettings = T.castDraft({error: '', settings})
          })
        } catch {
          set(s => {
            s.contactSettings.error = 'Unable to load contact settings, please try again.'
          })
        }
      }
      ignorePromise(f())
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
          await T.RPCGen.accountUserSetContactSettingsRpcPromise(
            {settings},
            S.waitingKeySettingsChatContactSettingsSave
          )
          get().dispatch.contactSettingsRefresh()
        } catch {
          set(s => {
            s.contactSettings.error = 'Unable to save contact settings, please try again.'
          })
        }
      }
      ignorePromise(f())
    },
    resetState: 'default',
    unfurlSettingsRefresh: () => {
      const f = async () => {
        if (!useConfigState.getState().loggedIn) {
          return
        }
        try {
          const result = await T.RPCChat.localGetUnfurlSettingsRpcPromise(
            undefined,
            S.waitingKeySettingsChatUnfurl
          )
          set(s => {
            s.unfurl = {
              unfurlError: undefined,
              unfurlMode: result.mode,
              unfurlWhitelist: T.castDraft(result.whitelist ?? []),
            }
          })
        } catch {
          set(s => {
            s.unfurl.unfurlError = 'Unable to load link preview settings, please try again.'
          })
        }
      }
      ignorePromise(f())
    },
    unfurlSettingsSaved: (unfurlMode, unfurlWhitelist) => {
      set(s => {
        s.unfurl = T.castDraft({unfurlError: undefined, unfurlMode, unfurlWhitelist})
      })
      const f = async () => {
        if (!useConfigState.getState().loggedIn) {
          return
        }
        try {
          await T.RPCChat.localSaveUnfurlSettingsRpcPromise(
            {mode: unfurlMode, whitelist: unfurlWhitelist},
            S.waitingKeySettingsChatUnfurl
          )
          get().dispatch.unfurlSettingsRefresh()
        } catch {
          set(s => {
            s.unfurl.unfurlError = 'Unable to save link preview settings, please try again.'
          })
        }
      }
      ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
