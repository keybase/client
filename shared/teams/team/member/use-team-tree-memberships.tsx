import * as C from '@/constants'
import * as Teams from '@/constants/teams'
import * as T from '@/constants/types'
import * as React from 'react'
import {produce} from 'immer'
import logger from '@/logger'
import {useEngineActionListener} from '@/engine/action-listener'
import {useTeamsList} from '@/teams/use-teams-list'

export type TeamTreeRowNotIn = {
  teamID: T.Teams.TeamID
  teamname: string
  memberCount?: number
  joinTime?: number
}
export type TeamTreeRowIn = {
  lastActivity?: number
  role: T.Teams.TeamRoleType
} & TeamTreeRowNotIn

type TeamTreeMembershipState = {
  expectedCount?: number
  guid?: number
  lastActivity: Map<T.Teams.TeamID, number>
  memberships: Array<T.RPCGen.TeamTreeMembership>
  sparseMemberInfos: Map<T.Teams.TeamID, T.Teams.TreeloaderSparseMemberInfo>
  targetTeamID: T.Teams.TeamID
  username: string
}

const makeEmptyTeamTreeMembershipState = (
  targetTeamID: T.Teams.TeamID,
  username: string
): TeamTreeMembershipState => ({
  lastActivity: new Map(),
  memberships: [],
  sparseMemberInfos: new Map(),
  targetTeamID,
  username,
})

const matchesTeamTreeMembershipState = (
  state: {targetTeamID: T.Teams.TeamID; username: string},
  targetTeamID: T.Teams.TeamID,
  username: string
) => state.targetTeamID === targetTeamID && state.username === username

const consumeTeamTreeMembershipValue = (
  value: T.RPCGen.TeamTreeMembershipValue
): T.Teams.TreeloaderSparseMemberInfo => ({
  joinTime: value.joinTime ?? undefined,
  type: Teams.teamRoleByEnum[value.role],
})

const getSparseMemberInfo = (
  sparseMemberInfos: ReadonlyMap<T.Teams.TeamID, T.Teams.TreeloaderSparseMemberInfo>,
  teamID: T.Teams.TeamID
) => sparseMemberInfos.get(teamID)

export const useTeamTreeMemberships = (targetTeamID: T.Teams.TeamID, username: string) => {
  const loadTeamTreeMemberships = C.useRPC(T.RPCGen.teamsLoadTeamTreeMembershipsAsyncRpcPromise)
  const {teams} = useTeamsList()
  const teamMetas = new Map(teams.map(team => [team.id, team] as const))
  const [state, setState] = React.useState(() => makeEmptyTeamTreeMembershipState(targetTeamID, username))
  const hasFocusedSinceMountRef = React.useRef(false)

  const loadLastActivity = React.useEffectEvent((teamID: T.Teams.TeamID) => {
    C.ignorePromise(
      T.RPCChat.localGetLastActiveAtMultiLocalRpcPromise(
        {teamIDs: [teamID], username},
        C.waitingKeyTeamsLoadTeamTreeActivity(teamID, username)
      )
        .then(activityMap => {
          setState(
            produce(draft => {
              if (!matchesTeamTreeMembershipState(draft, targetTeamID, username)) {
                return
              }
              Object.entries(activityMap ?? {}).forEach(([activityTeamID, lastActivity]) => {
                draft.lastActivity.set(activityTeamID, lastActivity)
              })
            })
          )
          return undefined
        })
        .catch(error => {
          logger.info(`loadTeamTreeActivity: unable to get activity for ${teamID}:${username}`, error)
        })
    )
  })

  const load = React.useCallback(() => {
    loadTeamTreeMemberships(
      [{teamID: targetTeamID, username}],
      () => {},
      error => {
        logger.warn(`Failed to load team tree memberships for ${targetTeamID}:${username}`, error)
      }
    )
  }, [loadTeamTreeMemberships, targetTeamID, username])

  const reload = React.useCallback(() => {
    setState(makeEmptyTeamTreeMembershipState(targetTeamID, username))
    load()
  }, [load, targetTeamID, username])

  React.useEffect(() => {
    load()
  }, [load])

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      if (hasFocusedSinceMountRef.current) {
        reload()
      } else {
        hasFocusedSinceMountRef.current = true
      }
    }, [reload])
  )

  useEngineActionListener('keybase.1.NotifyTeam.teamTreeMembershipsDone', action => {
    const {result} = action.payload.params
    if (result.targetTeamID !== targetTeamID || result.targetUsername !== username) {
      return
    }
    setState(prev => {
      const base = matchesTeamTreeMembershipState(prev, targetTeamID, username)
        ? prev
        : makeEmptyTeamTreeMembershipState(targetTeamID, username)
      if (base.guid !== undefined && result.guid < base.guid) {
        return base
      }
      if (base.guid === undefined || result.guid > base.guid) {
        const next = makeEmptyTeamTreeMembershipState(targetTeamID, username)
        next.expectedCount = result.expectedCount
        next.guid = result.guid
        return next
      }
      return produce(base, draft => {
        draft.expectedCount = result.expectedCount
      })
    })
  })

  useEngineActionListener('keybase.1.NotifyTeam.teamTreeMembershipsPartial', action => {
    const {membership} = action.payload.params
    if (membership.targetTeamID !== targetTeamID || membership.targetUsername !== username) {
      return
    }
    setState(prev => {
      const base = matchesTeamTreeMembershipState(prev, targetTeamID, username)
        ? prev
        : makeEmptyTeamTreeMembershipState(targetTeamID, username)
      if (base.guid !== undefined && membership.guid < base.guid) {
        return base
      }
      const reset = base.guid === undefined || membership.guid > base.guid
      return produce(base, draft => {
        draft.guid = membership.guid
        if (reset) {
          draft.memberships = [membership]
          draft.sparseMemberInfos = new Map()
        } else {
          draft.memberships.push(membership)
        }
        if (membership.result.s === T.RPCGen.TeamTreeMembershipStatus.ok) {
          draft.sparseMemberInfos.set(
            membership.result.ok.teamID,
            consumeTeamTreeMembershipValue(membership.result.ok)
          )
        }
      })
    })
    if (membership.result.s === T.RPCGen.TeamTreeMembershipStatus.ok) {
      loadLastActivity(membership.result.ok.teamID)
    }
  })

  const errors: Array<T.RPCGen.TeamTreeMembership> = []
  const nodesNotIn: Array<TeamTreeRowNotIn> = []
  const nodesIn: Array<TeamTreeRowIn> = []
  const visibleState = matchesTeamTreeMembershipState(state, targetTeamID, username)
    ? state
    : makeEmptyTeamTreeMembershipState(targetTeamID, username)

  // Note that we do not directly take any information directly from the TeamTree result other
  // than the **shape of the tree**. Membership metadata comes from the async tree-membership
  // results themselves instead of peeking into the global teams cache.
  for (const membership of visibleState.memberships) {
    const teamname = membership.teamName

    if (T.RPCGen.TeamTreeMembershipStatus.ok === membership.result.s) {
      const teamID = membership.result.ok.teamID
      const sparseMemberInfo = getSparseMemberInfo(visibleState.sparseMemberInfos, teamID)
      if (!sparseMemberInfo) {
        continue
      }

      const row = {
        joinTime: sparseMemberInfo.joinTime,
        lastActivity: visibleState.lastActivity.get(teamID),
        // memberCount should always be populated because the TeamList, which is synced
        // eagerly, provides it.
        memberCount: teamMetas.get(teamID)?.memberCount,
        teamID,
        teamname,
      }

      if ('none' !== sparseMemberInfo.type) {
        nodesIn.push({
          role: sparseMemberInfo.type,
          ...row,
        })
      } else {
        nodesNotIn.push(row)
      }
    } else if (T.RPCGen.TeamTreeMembershipStatus.error === membership.result.s) {
      errors.push(membership)
    }
  }
  return {
    errors,
    loading:
      visibleState.expectedCount === undefined ||
      visibleState.memberships.length < visibleState.expectedCount,
    nodesIn,
    nodesNotIn,
    reload,
  }
}
