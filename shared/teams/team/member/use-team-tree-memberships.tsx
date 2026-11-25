import * as C from '@/constants'
import * as Teams from '@/constants/teams'
import * as T from '@/constants/types'
import * as React from 'react'
import logger from '@/logger'
import {useCurrentUserState} from '@/stores/current-user'
import {useRPCLoad} from '@/util/use-rpc-load'
import {useTeamChanged} from '@/teams/use-team-changed'

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

type TeamTree = {
  errors: Array<T.RPCGen.TeamTreeMembership>
  nodesIn: Array<Omit<TeamTreeRowIn, 'lastActivity'>>
  nodesNotIn: Array<TeamTreeRowNotIn>
  teamIDs: ReadonlySet<T.Teams.TeamID>
}

const emptyTree: TeamTree = {errors: [], nodesIn: [], nodesNotIn: [], teamIDs: new Set()}
const noActivity: ReadonlyMap<T.Teams.TeamID, number> = new Map()

const toTeamTree = (memberships: ReadonlyArray<T.RPCGen.TeamTreeMembership> | null | undefined) => {
  const teamIDs = new Set<T.Teams.TeamID>()
  const tree: TeamTree = {errors: [], nodesIn: [], nodesNotIn: [], teamIDs}
  for (const membership of memberships ?? []) {
    if (membership.result.s === T.RPCGen.TeamTreeMembershipStatus.ok) {
      const {joinTime, memberCount, role, teamID} = membership.result.ok
      teamIDs.add(teamID)
      const row = {
        joinTime: joinTime ?? undefined,
        memberCount: memberCount ?? undefined,
        teamID,
        teamname: membership.teamName,
      }
      const type = Teams.teamRoleByEnum[role]
      if (type !== 'none') {
        tree.nodesIn.push({role: type, ...row})
      } else {
        tree.nodesNotIn.push(row)
      }
    } else if (membership.result.s === T.RPCGen.TeamTreeMembershipStatus.error) {
      tree.errors.push(membership)
    }
  }
  return tree
}

const notOnRows = new Set<keyof T.RPCGen.TeamChangedKinds>(['channels', 'keyRotated', 'memberShowcase', 'settings'])
// A server change can come with no kind set, which says nothing about what changed, so it
// reloads too
const changesTree = (kinds: T.RPCGen.TeamChangedKinds) => {
  const set = (Object.keys(kinds) as Array<keyof T.RPCGen.TeamChangedKinds>).filter(k => kinds[k])
  return set.length === 0 || set.some(k => !notOnRows.has(k))
}

export const useTeamTreeMemberships = (targetTeamID: T.Teams.TeamID, username: string) => {
  const currentUsername = useCurrentUserState(s => s.username)
  const key = `${currentUsername};${targetTeamID};${username}`
  const [activity, setActivity] = React.useState({byTeam: noActivity, key})

  const recordActivity = React.useEffectEvent(
    (forKey: string, activityMap: {[teamID: string]: number} | null | undefined) => {
      if (forKey !== key) {
        return
      }
      setActivity(prev => {
        const byTeam = new Map(prev.key === forKey ? prev.byTeam : undefined)
        Object.entries(activityMap ?? {}).forEach(([teamID, lastActivity]) => {
          byTeam.set(teamID, lastActivity)
        })
        return {byTeam, key: forKey}
      })
    }
  )

  // one call per team, so a team whose activity fails to load costs only that team's row
  const loadActivity = React.useEffectEvent((tree: TeamTree) => {
    const forKey = key
    for (const {teamID} of tree.nodesIn) {
      C.ignorePromise(
        T.RPCChat.localGetLastActiveAtMultiLocalRpcPromise(
          {teamIDs: [teamID], username},
          C.waitingKeyTeamsLoadTeamTreeActivity(teamID, username)
        )
          .then(activityMap => {
            recordActivity(forKey, activityMap)
            return undefined
          })
          .catch((error: unknown) => {
            logger.info(`loadTeamTreeActivity: unable to get activity for ${teamID}:${username}`, error)
          })
      )
    }
  })

  const {data, loading, refresh, reload} = useRPCLoad(
    T.RPCGen.teamsLoadTeamTreeMembershipsRpcPromise,
    [{teamID: targetTeamID, username}],
    {
      key,
      map: toTeamTree,
      onError: error => {
        logger.warn(`Failed to load team tree memberships for ${targetTeamID}:${username}`, error)
      },
      onResult: loadActivity,
    }
  )
  const tree = data ?? emptyTree

  const watchedTeamIDs = React.useMemo(() => new Set([targetTeamID, ...tree.teamIDs]), [targetTeamID, tree])
  useTeamChanged(watchedTeamIDs, kinds => {
    if (changesTree(kinds)) {
      refresh()
    }
  })

  const lastActivity = activity.key === key ? activity.byTeam : noActivity
  const nodesIn = React.useMemo(
    () => tree.nodesIn.map(node => ({...node, lastActivity: lastActivity.get(node.teamID)})),
    [tree, lastActivity]
  )
  return {errors: tree.errors, loading, nodesIn, nodesNotIn: tree.nodesNotIn, reload}
}
