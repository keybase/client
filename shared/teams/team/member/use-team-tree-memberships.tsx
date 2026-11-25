import * as C from '@/constants'
import * as Teams from '@/constants/teams'
import * as T from '@/constants/types'
import * as React from 'react'
import logger from '@/logger'
import {useCurrentUserState} from '@/stores/current-user'
import {refreshRpcParams, setRpcData, useRpcData} from '@/query'
import {useThrottledCallback} from '@/util/use-debounce'
import {teamGone, useTeamChanged} from '@/teams/use-team-changed'

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

// memberCount is left out: the service sends it when it caches a count, which every tree load
// does for each team, and the rows carry the count the load computed
// settings is in: a subteam made or deleted under a team of the tree comes as that team's settings
const changesTree = (kinds: T.RPCGen.TeamChangedKinds) =>
  kinds.deleted || kinds.exited || kinds.membership || kinds.renamed || kinds.roles || kinds.settings
// A tree load polls the server for every team in it, so changes reload at most once per window,
// long enough that a team changing steadily cannot keep the page polling the whole tree
const refreshWindowMs = 10_000

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

  const loadWaitingKey = C.waitingKeyTeamsLoadTeamTree(targetTeamID, username)
  const params = {teamID: targetTeamID, username}
  const {data, error, loadCount, loading, reload} = useRpcData(
    T.RPCGen.teamsLoadTeamTreeMembershipsRpcPromise,
    params,
    {
      onError: error => {
        logger.warn(`Failed to load team tree memberships for ${targetTeamID}:${username}`, error)
      },
      select: toTeamTree,
      waitingKey: loadWaitingKey,
    }
  )
  const inFlight = C.Waiting.useAnyWaiting(loadWaitingKey)
  // the newest load failed: its error replaces the rows of an older one
  const tree = (error ? undefined : data) ?? emptyTree

  // each load's rows get their activity; the focus below covers rows already cached at mount
  const lastLoadCount = React.useRef(loadCount)
  React.useEffect(() => {
    if (lastLoadCount.current === loadCount) {
      return
    }
    lastLoadCount.current = loadCount
    if (data && !error) {
      loadActivity(data)
    }
  }, [data, error, loadCount])

  // leading, so a lone change (an edit made on this page) shows at once
  // a load on the wire may predate the change: it finishes and one more follows
  const refresh = () => refreshRpcParams(T.RPCGen.teamsLoadTeamTreeMembershipsRpcPromise, params)
  const refreshSoon = useThrottledCallback(refresh, refreshWindowMs, {leading: true})
  React.useEffect(() => refreshSoon.cancel, [key, refreshSoon])

  const watchedTeamIDs = React.useMemo(() => new Set([targetTeamID, ...tree.teamIDs]), [targetTeamID, tree])
  useTeamChanged(watchedTeamIDs, (kinds, changedTeamID) => {
    if (changedTeamID === targetTeamID && teamGone(kinds)) {
      // the tree hangs off this team, so its rows are gone; the load says why
      refreshSoon.cancel()
      setRpcData(T.RPCGen.teamsLoadTeamTreeMembershipsRpcPromise, params, () => undefined)
      refresh()
    } else if (changesTree(kinds)) {
      refreshSoon()
    }
  })

  // chat activity sends no teamChanged, so refresh it when the page shows again
  const refreshActivity = React.useEffectEvent(() => {
    if (data && !error) loadActivity(data)
  })
  const [onFocus] = React.useState(() => () => {
    refreshActivity()
    return undefined
  })
  C.Router2.useSafeFocusEffect(onFocus)

  const lastActivity = activity.key === key ? activity.byTeam : noActivity
  const nodesIn = React.useMemo(
    () => tree.nodesIn.map(node => ({...node, lastActivity: lastActivity.get(node.teamID)})),
    [tree, lastActivity]
  )
  return {
    errors: tree.errors,
    loadError: error ? ((error as {desc?: string}).desc ?? error.message) : undefined,
    loading: loading || inFlight,
    nodesIn,
    nodesNotIn: tree.nodesNotIn,
    reload,
  }
}
