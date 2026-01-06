import type * as EngineGen from '@/actions/engine-gen-gen'
import logger from '@/logger'
import {serverConfigFileName} from '../platform'
import * as T from '../types'
import {ignorePromise} from '../utils'
import * as ArchiveUtil from '../archive/util'
import * as AutoResetUtil from '../autoreset/util'
import * as AvatarUtil from '@/common-adapters/avatar/util'
import * as BotsUtil from '../bots/util'
import {useChatState} from '../chat2'
import * as ChatUtil from '../chat2/util'
import {useConfigState} from '../config'
import {useCurrentUserState} from '../current-user'
import * as DeepLinksUtil from '../deeplinks/util'
import * as DevicesUtil from '../devices/util'
import * as FollowerUtil from '../followers/util'
import * as FSUtil from '../fs/util'
import * as GitUtil from '../git/util'
import * as NotifUtil from '../notifications/util'
import * as PeopleUtil from '../people/util'
import * as PinentryUtil from '../pinentry/util'
import {storeRegistry} from '../store-registry'
import {useSettingsContactsState} from '../settings-contacts'
import * as SettingsUtil from '../settings/util'
import * as SignupUtil from '../signup/util'
import {useTeamsState} from '../teams'
import * as TeamsUtil from '../teams/util'
import * as TrackerUtil from '../tracker2/util'
import * as UnlockFoldersUtil from '../unlock-folders/util'
import * as UsersUtil from '../users/util'

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

export const onEngineIncoming = (action: EngineGen.Actions) => {
  ArchiveUtil.onEngineIncoming(action)
  AutoResetUtil.onEngineIncoming(action)
  AvatarUtil.onEngineIncoming(action)
  BotsUtil.onEngineIncoming(action)
  ChatUtil.onEngineIncoming(action)
  storeRegistry.getState('config').dispatch.dynamic.onEngineIncomingDesktop?.(action)
  storeRegistry.getState('config').dispatch.dynamic.onEngineIncomingNative?.(action)
  storeRegistry.getState('config').dispatch.onEngineIncoming(action)
  DeepLinksUtil.onEngineIncoming(action)
  DevicesUtil.onEngineIncoming(action)
  FollowerUtil.onEngineIncoming(action)
  FSUtil.onEngineIncoming(action)
  GitUtil.onEngineIncoming(action)
  NotifUtil.onEngineIncoming(action)
  PeopleUtil.onEngineIncoming(action)
  PinentryUtil.onEngineIncoming(action)
  SettingsUtil.onEngineIncoming(action)
  SignupUtil.onEngineIncoming(action)
  TeamsUtil.onEngineIncoming(action)
  TrackerUtil.onEngineIncoming(action)
  UnlockFoldersUtil.onEngineIncoming(action)
  UsersUtil.onEngineIncoming(action)
}

