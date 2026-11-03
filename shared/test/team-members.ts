// What the service answers for a team's members (keybase.1.teams.teamGetMembersByID), for tests
// that run the app's real member loads on the fake engine.
import * as T from '@/constants/types'
import type {FakeEngine} from './fake-engine'

export const teamGetMembersByID = 'keybase.1.teams.teamGetMembersByID'

export const memberDetails = (username: string, role: T.RPCGen.TeamRole): T.RPCGen.TeamMemberDetails => ({
  fullName: username,
  joinTime: null,
  needsPUK: false,
  role,
  status: T.RPCGen.TeamMemberStatus.active,
  username,
  uv: {eldestSeqno: 1, uid: `uid-${username}`},
})

// Every team's members, by team id; a team not listed has none
export const answerTeamMembers = (
  fake: FakeEngine,
  byTeam: Record<string, ReadonlyArray<T.RPCGen.TeamMemberDetails>>
) => {
  fake.answer(teamGetMembersByID, (p: {id: string}) => byTeam[p.id] ?? [])
}
