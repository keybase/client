import * as React from 'react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {useLoadData} from '@/query'

// getMutualTeamsLocal makes the service localize every conversation the users
// share, and each of those remotely refreshes its participant list - one call
// was measured at ~82 outbound requests. Two consumers asking for the same
// usernames at the same instant (the chat channel suggestor mounting twice, or
// a profile and a suggestor for the same person) therefore has to collapse to
// one RPC, so the cache is keyed on the usernames rather than on the screen.
const mutualTeamsStaleMs = 60_000

const emptyTeams: ReadonlyArray<T.RPCChat.SharedTeam> = []

// order-independent: two callers listing the same people must hit the same entry
const mutualTeamsKey = (usernames: ReadonlyArray<string>) => [...usernames].sort().join(',')

export const useMutualTeams = (
  usernames: ReadonlyArray<string>,
  waitingKey: T.Waiting.WaitingKey,
  enabled = true,
  // pass something that changes when the caller wants fresh data (a profile's
  // identify guiID, say); it re-checks the stale window rather than forcing a load
  refreshKey?: unknown
): {loaded: boolean; loading: boolean; teams: ReadonlyArray<T.RPCChat.SharedTeam>} => {
  const cacheKey = mutualTeamsKey(usernames)
  // deliberately not gated on a non-empty username list: the service treats the
  // empty case as a real query, and skipping it would change what callers get
  const {
    data = emptyTeams,
    error,
    loaded,
    loading,
  } = useLoadData(
    'chat.mutualTeams',
    cacheKey,
    async signal => {
      const res = await T.RPCChat.localGetMutualTeamsLocalRpcPromise({usernames: [...usernames]}, waitingKey, signal)
      return res.teams ?? emptyTeams
    },
    {enabled, refreshKey, staleMs: mutualTeamsStaleMs}
  )
  React.useEffect(() => {
    if (error) {
      logger.warn(`Failed to load mutual teams for ${cacheKey}`, error)
    }
  }, [cacheKey, error])

  return React.useMemo(() => ({loaded, loading, teams: data}), [loaded, loading, data])
}
