import {ignorePromise} from '../utils'
import {serverConfigFileName} from '../platform'
import * as T from '../types'
import logger from '@/logger'
import {useChatState} from '../chat2'
import {useConfigState} from '../config'
import {useCurrentUserState} from '../current-user'
import {useSettingsContactsState} from '../settings-contacts'
import {useTeamsState} from '../teams'

export const initSharedSubscriptions = () => {
  useConfigState.subscribe((s, old) => {
    if (s.loadOnStartPhase === old.loadOnStartPhase) return

    if (s.loadOnStartPhase === 'startupOrReloginButNotInARush') {
      const getFollowerInfo = () => {
        const {uid} = useCurrentUserState.getState()
        logger.info(`getFollowerInfo: init; uid=${uid}`)
        if (uid) {
          // request follower info in the background
          T.RPCGen.configRequestFollowingAndUnverifiedFollowersRpcPromise()
            .then(() => {})
            .catch(() => {})
        }
      }

      const updateServerConfig = async () => {
        if (s.loggedIn) {
          try {
            await T.RPCGen.configUpdateLastLoggedInAndServerConfigRpcPromise({
              serverConfigPath: serverConfigFileName,
            })
          } catch {}
        }
      }

      const updateTeams = () => {
        useTeamsState.getState().dispatch.getTeams()
        useTeamsState.getState().dispatch.refreshTeamRoleMap()
      }

      const updateSettings = () => {
        useSettingsContactsState.getState().dispatch.loadContactImportEnabled()
      }

      const updateChat = async () => {
        // On login lets load the untrusted inbox. This helps make some flows easier
        if (useCurrentUserState.getState().username) {
          const {inboxRefresh} = useChatState.getState().dispatch
          inboxRefresh('bootstrap')
        }
        try {
          const rows = await T.RPCGen.configGuiGetValueRpcPromise({path: 'ui.inboxSmallRows'})
          const ri = rows.i ?? -1
          if (ri > 0) {
            useChatState.getState().dispatch.setInboxNumSmallRows(ri, true)
          }
        } catch {}
      }

      getFollowerInfo()
      ignorePromise(updateServerConfig())
      updateTeams()
      updateSettings()
      ignorePromise(updateChat())
    }
  })
}

