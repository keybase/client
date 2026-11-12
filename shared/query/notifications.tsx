import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {subscribeToEngineAction} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {refreshMethod} from './cache'

type Rpc = {readonly method: string}
// when: only for a notice this accepts
type Stale = Rpc | {readonly rpc: Rpc; readonly when: (action: EngineGen.Actions) => boolean}

const teamsLists = [T.RPCGen.teamsTeamListUnverifiedRpcPromise, T.RPCGen.teamsGetTeamRoleMapRpcPromise]

// Which reads each service notification makes stale
const isOurUser = (action: EngineGen.Actions) =>
  action.type === 'keybase.1.NotifyUsers.userChanged' &&
  action.payload.params.uid === useCurrentUserState.getState().uid

const staleOn: Partial<Record<EngineGen.ActionType, ReadonlyArray<Stale>>> = {
  'keybase.1.NotifyDeviceHistory.deviceHistoryChanged': [T.RPCGen.deviceDeviceHistoryListRpcPromise],
  'keybase.1.NotifyTeam.teamChangedByID': teamsLists,
  'keybase.1.NotifyTeam.teamDeleted': teamsLists,
  'keybase.1.NotifyTeam.teamExit': teamsLists,
  'keybase.1.NotifyTeam.teamMetadataUpdate': [T.RPCGen.teamsTeamListUnverifiedRpcPromise],
  'keybase.1.NotifyTeam.teamRoleMapChanged': teamsLists,
  // A device added or revoked elsewhere sends no deviceHistoryChanged. The service sends userChanged
  // (only ever for us) once it has dropped its cached copy of our keys, so a reload then sees it.
  'keybase.1.NotifyUsers.userChanged': [
    T.RPCGen.deviceDeviceHistoryListRpcPromise,
    {rpc: T.RPCGen.userProofSuggestionsRpcPromise, when: isOurUser},
  ],
}

declare global {
  var __hmr_rpcDataNotificationUnsubs: Array<() => void> | undefined
}
const unsubs = (globalThis.__hmr_rpcDataNotificationUnsubs ??= [])
for (const unsub of unsubs.splice(0)) unsub()
for (const [type, rpcs] of Object.entries(staleOn)) {
  unsubs.push(
    subscribeToEngineAction(type as EngineGen.ActionType, action => {
      for (const stale of rpcs) {
        if ('rpc' in stale) {
          if (stale.when(action)) refreshMethod(stale.rpc.method)
        } else {
          refreshMethod(stale.method)
        }
      }
    })
  )
}
