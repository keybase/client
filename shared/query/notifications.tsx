import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {subscribeToEngineAction} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {peekData, refreshMethod, stableKey} from './cache'

type Rpc = {readonly method: string}
type Stale = {
  readonly rpc: Rpc
  /** only for a notice this accepts */
  readonly when?: (action: EngineGen.Actions) => boolean
  /** for notices that keep coming, which then reload once per 5 debounces while they last: see refreshMethod */
  readonly debounceMs?: number
}

const devices: Stale = {rpc: T.RPCGen.deviceDeviceHistoryListRpcPromise}

const teamChangedKinds = (action: EngineGen.Actions) =>
  action.type === 'keybase.1.NotifyTeam.teamChanged' ? action.payload.params : undefined

// the teams list shows each team's name, your role, its member count, settings
// and your showcase of it. roleMap is in as well as roles: the service has no
// per-team roles to send when it had no role map to compare a new one against.
const changesTeamsList = (action: EngineGen.Actions) => {
  const kinds = teamChangedKinds(action)?.kinds
  return (
    !!kinds &&
    (kinds.membership ||
      kinds.roles ||
      kinds.roleMap ||
      kinds.renamed ||
      kinds.settings ||
      kinds.memberCount ||
      kinds.exited ||
      kinds.deleted ||
      kinds.memberShowcase)
  )
}

// one per role map version, and an older or equal version is already loaded
const newerRoleMap = (action: EngineGen.Actions) => {
  const params = teamChangedKinds(action)
  const rpc = T.RPCGen.teamsGetTeamRoleMapRpcPromise
  const loaded = peekData(stableKey(rpc.method, undefined)) as T.RPCGen.TeamRoleMapAndVersion | undefined
  return !!params?.kinds.roleMap && params.roleMapVersion > (loaded?.version ?? -1)
}

const isOurUser = (action: EngineGen.Actions) =>
  action.type === 'keybase.1.NotifyUsers.userChanged' &&
  action.payload.params.uid === useCurrentUserState.getState().uid

// Which reads each service notification makes stale
const staleOn: Partial<Record<EngineGen.ActionType, ReadonlyArray<Stale>>> = {
  // The service sends this whenever our devices may have changed (a key change, a change to our user
  // here, or a refresh that finds new links on our sigchain), once its own copy of us is fresh, so a
  // reload sees the change.
  'keybase.1.NotifyDeviceHistory.deviceHistoryChanged': [devices],
  'keybase.1.NotifyTeam.teamChanged': [
    // The list spans every team, so its changes come in bursts across teams: one gregor team.change
    // carries a row per team, the member count loop flushes every team it counted, and a local
    // change is echoed back by the server.
    {debounceMs: 2_000, rpc: T.RPCGen.teamsTeamListUnverifiedRpcPromise, when: changesTeamsList},
    {rpc: T.RPCGen.teamsGetTeamRoleMapRpcPromise, when: newerRoleMap},
  ],
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
