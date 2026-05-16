import * as C from '@/constants'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'
import * as Teams from '@/constants/teams'
import logger from '@/logger'
import * as React from 'react'
import {useTeamsListMap, useTeamsRoleMap} from '@/teams/use-teams-list'
import {updateChosenChannelsTeamnames, useChosenChannelsTeamnames} from '@/chat/conversation/manage-channels-badge'
import {useConversationThreadSelector} from '@/chat/conversation/thread-context'

type ChatTeamState = {
  allowPromote: boolean
  description: string
  loading: boolean
  role: T.Teams.MaybeTeamRoleType
  teamname: string
  yourOperations: T.Teams.TeamOperations
}

type ChatTeamMembersState = {
  loading: boolean
  members: ReadonlyMap<string, T.Teams.MemberInfo>
}

type ChatTeamNamesState = {
  loading: boolean
  teamnames: ReadonlyMap<T.Teams.TeamID, string>
}

type ChatTeamNamesStateInternal = ChatTeamNamesState & {
  loadedTeamIDsKey?: string
}

type ChatTeamStateInternal = ChatTeamState & {
  loadedTeamID?: T.Teams.TeamID
}

type ChatTeamMembersStateInternal = ChatTeamMembersState & {
  loadedTeamID?: T.Teams.TeamID
}

type ChatManageChannelsBadgeState = {
  loading: boolean
  showBadge: boolean
}

export type ChatTeam = ChatTeamState & {
  reload: () => Promise<void>
}

export type ChatTeamMembers = ChatTeamMembersState & {
  reload: () => Promise<void>
}

export type ChatTeamNames = ChatTeamNamesState & {
  reload: () => Promise<void>
}

export type ChatManageChannelsBadge = ChatManageChannelsBadgeState & {
  dismiss: () => Promise<void>
}

const emptyChatTeamState: ChatTeamStateInternal = {
  allowPromote: false,
  description: '',
  loadedTeamID: undefined,
  loading: false,
  role: 'none',
  teamname: '',
  yourOperations: Teams.initialCanUserPerform,
}

const makeEmptyChatTeamMembersState = (): ChatTeamMembersStateInternal => ({
  loadedTeamID: undefined,
  loading: false,
  members: new Map<string, T.Teams.MemberInfo>(),
})

const makeEmptyChatTeamNamesState = (): ChatTeamNamesStateInternal => ({
  loadedTeamIDsKey: undefined,
  loading: false,
  teamnames: new Map<T.Teams.TeamID, string>(),
})

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const parseTeamIDsKey = (teamIDsKey: string): Array<T.Teams.TeamID> =>
  teamIDsKey ? teamIDsKey.split(',').map(teamID => teamID) : []

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

const annotatedTeamToChatTeamState = (
  annotatedTeam: T.RPCGen.AnnotatedTeam,
  roleAndDetails: T.Teams.TeamRoleAndDetails | undefined
): ChatTeamState => ({
  allowPromote: annotatedTeam.showcase.anyMemberShowcase,
  description: annotatedTeam.showcase.description ?? '',
  loading: false,
  role: roleAndDetails?.role ?? 'none',
  teamname: annotatedTeam.name,
  yourOperations: Teams.deriveCanPerform(roleAndDetails),
})

const useChatTeamRaw = (teamID: T.Teams.TeamID, teamname?: string, enabled = true): ChatTeam => {
  const validTeamID = loadableTeamID(teamID)
  const teamMetaByID = useTeamsListMap()
  const {loadIfStale: loadRoleMapIfStale, roleMap} = useTeamsRoleMap()
  const [state, setState] = React.useState<ChatTeamStateInternal>(() => ({
    ...emptyChatTeamState,
    loadedTeamID: validTeamID,
    teamname: teamname ?? '',
  }))
  const requestVersionRef = React.useRef(0)
  const clearState = React.useCallback(() => {
    requestVersionRef.current++
    setState({...emptyChatTeamState, loadedTeamID: validTeamID, teamname: teamname ?? ''})
  }, [teamname, validTeamID])

  const teamMeta = validTeamID ? teamMetaByID.get(validTeamID) : undefined
  const knownTeamname = teamname || teamMeta?.teamname || ''

  const reload = React.useCallback(async () => {
    if (!enabled || !validTeamID) {
      clearState()
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true, teamname: prev.teamname || knownTeamname}))
    try {
      const [annotatedTeam] = await Promise.all([
        T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID: validTeamID}),
        loadRoleMapIfStale(),
      ])
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      setState({
        ...annotatedTeamToChatTeamState(annotatedTeam, undefined),
        loadedTeamID: validTeamID,
      })
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to load chat team metadata for ${validTeamID}`, error)
      setState(prev => ({...prev, loading: false, teamname: prev.teamname || knownTeamname}))
    }
  }, [clearState, enabled, knownTeamname, loadRoleMapIfStale, validTeamID])

  const visibleState =
    enabled && state.loadedTeamID !== validTeamID
      ? {...emptyChatTeamState, loadedTeamID: validTeamID, teamname: teamname ?? ''}
      : state
  const roleAndDetails = roleAndDetailsFromMap(roleMap, validTeamID ?? T.Teams.noTeamID)
  const yourOperations = React.useMemo(() => Teams.deriveCanPerform(roleAndDetails), [roleAndDetails])
  useEngineActionListener('keybase.1.NotifyTeam.teamMetadataUpdate', () => {
    if (enabled) {
      clearState()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamRoleMapChanged', () => {
    if (enabled) {
      clearState()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clearState()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clearState()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clearState()
    }
  })

  return {
    ...visibleState,
    allowPromote: teamMeta?.allowPromote ?? visibleState.allowPromote,
    reload,
    role: roleAndDetails?.role ?? teamMeta?.role ?? 'none',
    teamname: knownTeamname || visibleState.teamname,
    yourOperations,
  }
}

const useChatTeamMembersRaw = (teamID: T.Teams.TeamID, enabled = true): ChatTeamMembers => {
  const validTeamID = loadableTeamID(teamID)
  const [state, setState] = React.useState<ChatTeamMembersStateInternal>(() =>
    makeEmptyChatTeamMembersState()
  )
  const requestVersionRef = React.useRef(0)
  const clearState = React.useCallback(() => {
    requestVersionRef.current++
    setState({...makeEmptyChatTeamMembersState(), loadedTeamID: validTeamID})
  }, [validTeamID])
  if (
    (!enabled || !validTeamID) &&
    (state.loadedTeamID !== undefined || state.loading || state.members.size)
  ) {
    setState(makeEmptyChatTeamMembersState())
  }

  const loadMemberInfos = React.useCallback(
    async (teamID: T.Teams.TeamID) =>
      Teams.rpcDetailsToMemberInfos((await T.RPCGen.teamsTeamGetMembersByIDRpcPromise({id: teamID})) ?? []),
    []
  )

  const loadMembers = React.useCallback(async () => {
    if (!enabled || !validTeamID) {
      return
    }
    const requestVersion = ++requestVersionRef.current
    try {
      const members = await loadMemberInfos(validTeamID)
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      useUsersState.getState().dispatch.updates(
        [...members.values()].map(member => ({
          info: {fullname: member.fullName},
          name: member.username,
        }))
      )
      setState({loadedTeamID: validTeamID, loading: false, members})
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to reload chat team members for ${validTeamID}`, error)
      setState(prev => ({...prev, loadedTeamID: validTeamID, loading: false}))
    }
  }, [enabled, loadMemberInfos, validTeamID])

  const reload = React.useCallback(async () => {
    if (!enabled || !validTeamID) {
      clearState()
      return
    }
    setState(prev => ({...prev, loadedTeamID: validTeamID, loading: true}))
    await loadMembers()
  }, [clearState, enabled, loadMembers, validTeamID])

  const visibleState =
    !enabled || !validTeamID
      ? {...makeEmptyChatTeamMembersState(), loadedTeamID: validTeamID}
      : state.loadedTeamID !== validTeamID
        ? {...makeEmptyChatTeamMembersState(), loadedTeamID: validTeamID, loading: true}
        : state

  React.useEffect(() => {
    if (!enabled || !validTeamID) {
      requestVersionRef.current += 1
      return undefined
    }
    const requestVersion = ++requestVersionRef.current
    const f = async () => {
      try {
        const members = await loadMemberInfos(validTeamID)
        if (requestVersion !== requestVersionRef.current) {
          return
        }
        useUsersState.getState().dispatch.updates(
          [...members.values()].map(member => ({
            info: {fullname: member.fullName},
            name: member.username,
          }))
        )
        setState({loadedTeamID: validTeamID, loading: false, members})
      } catch (error) {
        if (requestVersion !== requestVersionRef.current) {
          return
        }
        logger.warn(`Failed to reload chat team members for ${validTeamID}`, error)
        setState(prev => ({...prev, loadedTeamID: validTeamID, loading: false}))
      }
    }
    C.ignorePromise(f())
    return () => {
      if (requestVersionRef.current === requestVersion) {
        requestVersionRef.current += 1
      }
    }
  }, [enabled, loadMemberInfos, validTeamID])
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      void loadMembers()
    }, [loadMembers])
  )
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clearState()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clearState()
    }
  })

  return {...visibleState, reload}
}

const useChatTeamNamesRaw = (teamIDs: ReadonlyArray<T.Teams.TeamID>, enabled = true): ChatTeamNames => {
  const username = useCurrentUserState(s => s.username)
  const teamIDsKey = [
    ...new Set(teamIDs.map(loadableTeamID).filter((teamID): teamID is T.Teams.TeamID => !!teamID)),
  ]
    .sort()
    .join(',')
  const validTeamIDs = React.useMemo(() => parseTeamIDsKey(teamIDsKey), [teamIDsKey])
  const [state, setState] = React.useState<ChatTeamNamesStateInternal>(() => makeEmptyChatTeamNamesState())
  const requestVersionRef = React.useRef(0)
  const clearState = React.useCallback(() => {
    requestVersionRef.current++
    setState(makeEmptyChatTeamNamesState())
  }, [])
  if (
    (!enabled || !teamIDsKey || !username) &&
    (state.loadedTeamIDsKey || state.loading || state.teamnames.size)
  ) {
    setState(makeEmptyChatTeamNamesState())
  }

  const loadTeamNamesForIDs = React.useCallback(async (teamIDs: ReadonlyArray<T.Teams.TeamID>) => {
    const resolvedTeamnames = await Promise.all(
      teamIDs.map(async teamID => {
        try {
          const teamname = (await T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID})).name
          return teamname ? ([teamID, teamname] as const) : undefined
        } catch (error) {
          logger.warn(`Failed to load chat team name for ${teamID}`, error)
          return undefined
        }
      })
    )
    const teamnames = new Map<T.Teams.TeamID, string>()
    resolvedTeamnames.forEach(entry => {
      if (entry) {
        teamnames.set(entry[0], entry[1])
      }
    })
    return teamnames
  }, [])

  const loadTeamNames = React.useCallback(async () => {
    if (!enabled || !teamIDsKey || !username) {
      return
    }
    const requestVersion = ++requestVersionRef.current
    try {
      const teamnames = await loadTeamNamesForIDs(validTeamIDs)
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      setState({
        loadedTeamIDsKey: teamIDsKey,
        loading: false,
        teamnames,
      })
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to load chat team names for ${teamIDsKey}`, error)
      setState(prev => ({
        loadedTeamIDsKey: teamIDsKey,
        loading: false,
        teamnames: prev.loadedTeamIDsKey === teamIDsKey ? new Map(prev.teamnames) : new Map(),
      }))
    }
  }, [enabled, loadTeamNamesForIDs, teamIDsKey, username, validTeamIDs])

  const reload = React.useCallback(async () => {
    if (!enabled || !teamIDsKey || !username) {
      clearState()
      return
    }
    setState(prev => ({
      loadedTeamIDsKey: teamIDsKey,
      loading: true,
      teamnames: prev.loadedTeamIDsKey === teamIDsKey ? new Map(prev.teamnames) : new Map(),
    }))
    await loadTeamNames()
  }, [clearState, enabled, loadTeamNames, teamIDsKey, username])

  const visibleState =
    !enabled || !teamIDsKey || !username
      ? makeEmptyChatTeamNamesState()
      : state.loadedTeamIDsKey !== teamIDsKey
        ? {...makeEmptyChatTeamNamesState(), loadedTeamIDsKey: teamIDsKey, loading: true}
        : state

  React.useEffect(() => {
    if (!enabled || !teamIDsKey || !username) {
      requestVersionRef.current += 1
      return undefined
    }
    const requestVersion = ++requestVersionRef.current
    const f = async () => {
      try {
        const teamnames = await loadTeamNamesForIDs(validTeamIDs)
        if (requestVersion !== requestVersionRef.current) {
          return
        }
        setState({
          loadedTeamIDsKey: teamIDsKey,
          loading: false,
          teamnames,
        })
      } catch (error) {
        if (requestVersion !== requestVersionRef.current) {
          return
        }
        logger.warn(`Failed to load chat team names for ${teamIDsKey}`, error)
        setState(prev => ({
          loadedTeamIDsKey: teamIDsKey,
          loading: false,
          teamnames: prev.loadedTeamIDsKey === teamIDsKey ? new Map(prev.teamnames) : new Map(),
        }))
      }
    }
    C.ignorePromise(f())
    return () => {
      if (requestVersionRef.current === requestVersion) {
        requestVersionRef.current += 1
      }
    }
  }, [enabled, loadTeamNamesForIDs, teamIDsKey, username, validTeamIDs])
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      void loadTeamNames()
    }, [loadTeamNames])
  )
  useEngineActionListener('keybase.1.NotifyTeam.teamMetadataUpdate', () => {
    if (enabled && teamIDsKey) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled && validTeamIDs.includes(action.payload.params.teamID)) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled && validTeamIDs.includes(action.payload.params.teamID)) {
      requestVersionRef.current++
      setState(prev => {
        const teamnames = new Map(prev.teamnames)
        teamnames.delete(action.payload.params.teamID)
        return {loadedTeamIDsKey: prev.loadedTeamIDsKey, loading: false, teamnames}
      })
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && validTeamIDs.includes(action.payload.params.teamID)) {
      requestVersionRef.current++
      setState(prev => {
        const teamnames = new Map(prev.teamnames)
        teamnames.delete(action.payload.params.teamID)
        return {loadedTeamIDsKey: prev.loadedTeamIDsKey, loading: false, teamnames}
      })
    }
  })

  return {...visibleState, reload}
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
  const {teamID, teamType, teamname} = useConversationThreadSelector(
    C.useShallow(s => ({
      teamID: s.meta.teamID,
      teamType: s.meta.teamType,
      teamname: s.meta.teamname,
    }))
  )
  const outer = React.useContext(ChatTeamContext)
  const enabled = teamType !== 'adhoc' && !!loadableTeamID(teamID)
  const sameAsOuter = outer?.teamID === teamID
  const team = useChatTeamRaw(teamID, teamname, enabled && !sameAsOuter)
  const members = useChatTeamMembersRaw(teamID, enabled && !sameAsOuter)
  const value: ChatTeamContextValue = sameAsOuter ? outer : {members, team, teamID}
  return <ChatTeamContext.Provider value={value}>{children}</ChatTeamContext.Provider>
}

export const useChatTeam = (teamID: T.Teams.TeamID, teamname?: string): ChatTeam => {
  const context = React.useContext(ChatTeamContext)
  const useContextValue = context?.teamID === teamID
  const raw = useChatTeamRaw(teamID, teamname, !useContextValue)
  return useContextValue ? context.team : raw
}

export const useChatTeamMembers = (teamID: T.Teams.TeamID): ChatTeamMembers => {
  const context = React.useContext(ChatTeamContext)
  const useContextValue = context?.teamID === teamID
  const raw = useChatTeamMembersRaw(teamID, !useContextValue)
  return useContextValue ? context.members : raw
}

export const useChatTeamNames = (teamIDs: ReadonlyArray<T.Teams.TeamID>): ChatTeamNames =>
  useChatTeamNamesRaw(teamIDs)

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
