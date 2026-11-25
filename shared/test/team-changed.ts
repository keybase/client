// The service's keybase.1.NotifyTeam.teamChanged, for tests on the fake engine. Install the engine
// with onEngineIncoming: _onEngineIncoming so the push reaches the app's listeners.
import type * as T from '@/constants/types'
import type {FakeEngine} from './fake-engine'
import {flush} from './flush'

export const noTeamChanges: T.RPCGen.TeamChangedKinds = {
  channels: false,
  deleted: false,
  exited: false,
  keyRotated: false,
  memberCount: false,
  memberShowcase: false,
  membership: false,
  renamed: false,
  roleMap: false,
  roles: false,
  settings: false,
}

export const pushTeamChanged = async (
  fake: FakeEngine,
  // empty for the kinds about the current user (roleMap, memberShowcase)
  teamID: T.Teams.TeamID,
  kinds: Partial<T.RPCGen.TeamChangedKinds>,
  roleMapVersion = 0
) => {
  await fake.push(
    'keybase.1.NotifyTeam.teamChanged',
    {kinds: {...noTeamChanges, ...kinds}, roleMapVersion, teamID},
    {oneway: true}
  )
  await flush()
}
