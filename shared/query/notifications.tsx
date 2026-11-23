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
  /** for notices that keep coming, which then reload once per 5 debounces while they last: see refreshMethod */
  readonly debounceMs?: number
}

/** team notices come one per message in a busy team */
export const teamNoticeDebounceMs = 2_000
const teamNotice = {debounceMs: teamNoticeDebounceMs}
const teamsList: Stale = {rpc: T.RPCGen.teamsTeamListUnverifiedRpcPromise, ...teamNotice}
const teamsRoleMap: Stale = {rpc: T.RPCGen.teamsGetTeamRoleMapRpcPromise, ...teamNotice}
const devices: Stale = {rpc: T.RPCGen.deviceDeviceHistoryListRpcPromise}

const isOurUser = (action: EngineGen.Actions) =>
  action.type === 'keybase.1.NotifyUsers.userChanged' &&
  action.payload.params.uid === useCurrentUserState.getState().uid

// Which reads each service notification makes stale
const staleOn: Partial<Record<EngineGen.ActionType, ReadonlyArray<Stale>>> = {
  // The service sends this for any device added or revoked, here or elsewhere, once its own
  // copy of our keys is fresh, so a reload sees the change.
  'keybase.1.NotifyDeviceHistory.deviceHistoryChanged': [devices],
  'keybase.1.NotifyTeam.teamChangedByID': [teamsList, teamsRoleMap],
  'keybase.1.NotifyTeam.teamDeleted': [teamsList, teamsRoleMap],
  'keybase.1.NotifyTeam.teamExit': [teamsList, teamsRoleMap],
  'keybase.1.NotifyTeam.teamMetadataUpdate': [teamsList],
  'keybase.1.NotifyTeam.teamRoleMapChanged': [teamsList, teamsRoleMap],
  'keybase.1.NotifyUsers.userChanged': [{rpc: T.RPCGen.userProofSuggestionsRpcPromise, when: isOurUser}],
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
