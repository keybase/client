import * as C from '@/constants'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'
import * as Teams from '@/constants/teams'
import logger from '@/logger'
import * as React from 'react'
import {useTeamsListMap, useTeamsRoleMap} from '@/teams/use-teams-list'
import {
  type CachedResourceCache,
  getCachedResourceCache,
  useCachedResource,
} from '@/util/use-cached-resource'
import {updateChosenChannelsTeamnames, useChosenChannelsTeamnames} from './manage-channels-badge'
import {useThreadMeta} from './thread-context'
import {registerExternalResetter} from '@/util/zustand'

type ChatTeamState = {
  role: T.Teams.MaybeTeamRoleType
  teamname: string
  yourOperations: T.Teams.TeamOperations
}

type ChatTeamMembersState = {
  loading: boolean
  members: ReadonlyMap<string, T.Teams.MemberInfo>
}

type ChatManageChannelsBadgeState = {
  loading: boolean
  showBadge: boolean
}

export type ChatTeam = ChatTeamState

export type ChatTeamMembers = ChatTeamMembersState & {
  reload: () => Promise<void>
}

export type ChatManageChannelsBadge = ChatManageChannelsBadgeState & {
  dismiss: () => Promise<void>
}

type ChatTeamMembersData = ReadonlyMap<string, T.Teams.MemberInfo>
type TeamCacheKey = T.Teams.TeamID | undefined
type TeamCacheMap<D> = Map<TeamCacheKey, CachedResourceCache<D, TeamCacheKey>>

const emptyChatTeamMembersData: ChatTeamMembersData = new Map<string, T.Teams.MemberInfo>()

// Module level so switching conversations (or channels within a team) reuses
// loaded members instead of refetching. teamChangedByID & friends invalidate.
const chatTeamMembersCacheMap: TeamCacheMap<ChatTeamMembersData> = new Map()
const chatTeamReloadStaleMs = 5 * 60_000

// module scope outlives sign-out, so the next user would be served the previous
// user's team data and member lists
registerExternalResetter('chat-team-hooks-caches', () => {
  chatTeamCacheMap.clear()
  chatTeamMembersCacheMap.clear()
})

// A disabled "shadow" instance (one that returns the context value instead of
// its own) must NOT share the loader's cache: with enabled=false
// useCachedResource resets the cache, which would clobber the loader's data.
// Give shadows a private throwaway map so their resets are harmless.
const useTeamCacheMap = <D,>(sharedCacheMap: TeamCacheMap<D>, forceLocalCache: boolean) => {
  const [localCacheMap] = React.useState<TeamCacheMap<D>>(() => new Map())
  return forceLocalCache ? localCacheMap : sharedCacheMap
}

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const roleAndDetailsFromMap = (
  map: T.RPCGen.TeamRoleMapAndVersion,
  teamID: T.Teams.TeamID
): T.Teams.TeamRoleAndDetails | undefined => {
  const details = map.teams?.[teamID]
  if (!details) {
    return undefined
  }
  return {
    implicitAdmin:
      details.implicitRole === T.RPCGen.TeamRole.admin || details.implicitRole === T.RPCGen.TeamRole.owner,
    role: Teams.teamRoleByEnum[details.role],
  }
}

const useChatTeamRaw = (teamID: T.Teams.TeamID, teamname?: string): ChatTeam => {
  const validTeamID = loadableTeamID(teamID)
  const teamMetaByID = useTeamsListMap()
  const {roleMap} = useTeamsRoleMap()

  const teamMeta = validTeamID ? teamMetaByID.get(validTeamID) : undefined
  const knownTeamname = teamname || teamMeta?.teamname || ''

  const roleAndDetails = roleAndDetailsFromMap(roleMap, validTeamID ?? T.Teams.noTeamID)
  const yourOperations = React.useMemo(() => Teams.deriveCanPerform(roleAndDetails), [roleAndDetails])

  return {
    role: roleAndDetails?.role ?? teamMeta?.role ?? 'none',
    teamname: knownTeamname,
    yourOperations,
  }
}

const useChatTeamMembersRaw = (
  teamID: T.Teams.TeamID,
  enabled = true,
  subscribeToUpdates = enabled,
  forceLocalCache = false
): ChatTeamMembers => {
  const validTeamID = loadableTeamID(teamID)
  const cacheMap = useTeamCacheMap(chatTeamMembersCacheMap, forceLocalCache)
  const cache = React.useMemo(
    () => getCachedResourceCache(cacheMap, emptyChatTeamMembersData, validTeamID),
    [cacheMap, validTeamID]
  )

  const {clear, data, loaded, loading, reload} = useCachedResource({
    cache,
    cacheKey: validTeamID,
    enabled: enabled && !!validTeamID,
    initialData: emptyChatTeamMembersData,
    load: async () => {
      const members = Teams.rpcDetailsToMemberInfos(
        (await T.RPCGen.teamsTeamGetMembersByIDRpcPromise({id: validTeamID ?? T.Teams.noTeamID})) ?? []
      )
      useUsersState.getState().dispatch.updates(
        [...members.values()].map(member => ({
          info: {fullname: member.fullName},
          name: member.username,
        }))
      )
      return members
    },
    onError: error => {
      logger.warn(`Failed to reload chat team members for ${validTeamID}`, error)
    },
    staleMs: chatTeamReloadStaleMs,
  })

  useEngineActionListener(
    'keybase.1.NotifyTeam.teamChangedByID',
    action => {
      if (action.payload.params.teamID === validTeamID) {
        void reload()
      }
    },
    subscribeToUpdates
  )
  useEngineActionListener(
    'keybase.1.NotifyTeam.teamDeleted',
    action => {
      if (action.payload.params.teamID === validTeamID) {
        clear(validTeamID)
      }
    },
    subscribeToUpdates
  )
  useEngineActionListener(
    'keybase.1.NotifyTeam.teamExit',
    action => {
      if (action.payload.params.teamID === validTeamID) {
        clear(validTeamID)
      }
    },
    subscribeToUpdates
  )

  // `loading` means "nothing to show yet" - a background revalidation of cached
  // data must not flip callers back to their empty/spinner state.
  return {loading: loading && !loaded, members: data, reload}
}

type ChatTeamContextValue = {
  members: ChatTeamMembers
  team: ChatTeam
  teamID: T.Teams.TeamID
}

const ChatTeamContext = React.createContext<ChatTeamContextValue | null>(null)
ChatTeamContext.displayName = 'ChatTeamContext'

export const ChatTeamProvider = (props: React.PropsWithChildren) => {
  const {children} = props
  const {teamID, teamType, teamname} = useThreadMeta(
    C.useShallow(m => ({
      teamID: m.teamID,
      teamType: m.teamType,
      teamname: m.teamname,
    }))
  )
  const outer = React.useContext(ChatTeamContext)
  const enabled = teamType !== 'adhoc' && !!loadableTeamID(teamID)
  const sameAsOuter = outer?.teamID === teamID
  const team = useChatTeamRaw(teamID, teamname)
  const members = useChatTeamMembersRaw(
    teamID,
    enabled && !sameAsOuter,
    enabled && !sameAsOuter,
    sameAsOuter
  )
  const value: ChatTeamContextValue = sameAsOuter ? outer! : {members, team, teamID}
  return <ChatTeamContext.Provider value={value}>{children}</ChatTeamContext.Provider>
}

export const useChatTeam = (teamID: T.Teams.TeamID, teamname?: string): ChatTeam => {
  const context = React.useContext(ChatTeamContext)
  const useContextValue = context?.teamID === teamID
  const raw = useChatTeamRaw(teamID, teamname)
  return useContextValue ? context.team : raw
}

export const useChatTeamMembers = (teamID: T.Teams.TeamID): ChatTeamMembers => {
  const context = React.useContext(ChatTeamContext)
  const useContextValue = context?.teamID === teamID
  const raw = useChatTeamMembersRaw(teamID, !useContextValue, !useContextValue, useContextValue)
  return useContextValue ? context.members : raw
}

// Context-only role lookup for per-message-row use. useChatTeamMembers mounts
// engine listeners and a fetch fallback per caller, which is too heavy to run
// once per visible row; rows always render under the conversation's
// ChatTeamProvider so the context has the data.
export const useChatTeamMemberRole = (
  teamID: T.Teams.TeamID,
  username: string
): T.Teams.MemberInfo['type'] | undefined => {
  const context = React.useContext(ChatTeamContext)
  return context?.teamID === teamID ? context.members.members.get(username)?.type : undefined
}

export const useChatManageChannelsBadge = (
  teamID: T.Teams.TeamID,
  teamname: string
): ChatManageChannelsBadge => {
  const username = useCurrentUserState(s => s.username)
  const validTeamID = loadableTeamID(teamID)
  const chosenChannelsTeamnames = useChosenChannelsTeamnames()
  const [optimisticDismissedKey, setOptimisticDismissedKey] = React.useState('')
  const canLoad = !!validTeamID && !!teamname && !!username
  const optimisticKey = `${username}:${teamname}`
  const showBadge = canLoad
    ? !chosenChannelsTeamnames.has(teamname) && optimisticDismissedKey !== optimisticKey
    : false
  const state = {
    loading: false,
    showBadge,
  }

  const dismiss = React.useCallback(async () => {
    if (!canLoad) {
      return
    }
    const nextTeamnames = new Set(chosenChannelsTeamnames)
    if (nextTeamnames.has(teamname)) {
      return
    }
    nextTeamnames.add(teamname)
    setOptimisticDismissedKey(optimisticKey)
    try {
      await updateChosenChannelsTeamnames(nextTeamnames)
    } catch (error) {
      logger.warn(`Failed to update chosen channel state for ${teamname}`, error)
      setOptimisticDismissedKey(key => (key === optimisticKey ? '' : key))
    }
  }, [canLoad, chosenChannelsTeamnames, optimisticKey, teamname])

  return {...state, dismiss}
}
