import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {subscribeToEngineAction} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {refreshMethod} from './cache'

type Rpc = {readonly method: string}
type Stale = {
  readonly rpc: Rpc
  /** only for a notice this accepts */
  readonly when?: (action: EngineGen.Actions) => boolean
  /** for notices that keep coming: see refreshMethod */
  readonly debounceMs?: number
}

// one per message in a busy team
const teamNotice = {debounceMs: 2_000}
const teamsList: Stale = {rpc: T.RPCGen.teamsTeamListUnverifiedRpcPromise, ...teamNotice}
const teamsRoleMap: Stale = {rpc: T.RPCGen.teamsGetTeamRoleMapRpcPromise, ...teamNotice}
const devices: Stale = {rpc: T.RPCGen.deviceDeviceHistoryListRpcPromise}

const isOurUser = (action: EngineGen.Actions) =>
  action.type === 'keybase.1.NotifyUsers.userChanged' &&
  action.payload.params.uid === useCurrentUserState.getState().uid

// Which reads each service notification makes stale
const staleOn: Partial<Record<EngineGen.ActionType, ReadonlyArray<Stale>>> = {
  'keybase.1.NotifyDeviceHistory.deviceHistoryChanged': [devices],
  'keybase.1.NotifyTeam.teamChangedByID': [teamsList, teamsRoleMap],
  'keybase.1.NotifyTeam.teamDeleted': [teamsList, teamsRoleMap],
  'keybase.1.NotifyTeam.teamExit': [teamsList, teamsRoleMap],
  'keybase.1.NotifyTeam.teamMetadataUpdate': [teamsList],
  'keybase.1.NotifyTeam.teamRoleMapChanged': [teamsList, teamsRoleMap],
  // A device added or revoked elsewhere sends no deviceHistoryChanged. The service sends userChanged
  // once it has dropped its cached copy of our keys, so a reload then sees it.
  'keybase.1.NotifyUsers.userChanged': [
    devices,
    {rpc: T.RPCGen.userProofSuggestionsRpcPromise, when: isOurUser},
  ],
}

declare global {
  var __hmr_rpcDataNotificationUnsubs: Array<() => void> | undefined
}
const unsubs = (globalThis.__hmr_rpcDataNotificationUnsubs ??= [])
for (const unsub of unsubs.splice(0)) unsub()
for (const [type, stale] of Object.entries(staleOn)) {
  unsubs.push(
    subscribeToEngineAction(type as EngineGen.ActionType, action => {
      for (const {debounceMs, rpc, when} of stale) {
        if (!when || when(action)) {
          refreshMethod(rpc.method, undefined, debounceMs)
        }
      }
    })
  )
}
