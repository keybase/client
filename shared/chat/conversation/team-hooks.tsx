import * as C from '@/constants'
import {bodyToJSON} from '@/constants/rpc-utils'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import * as ConvoState from '@/stores/convostate'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'
import * as Teams from '@/constants/teams'
import logger from '@/logger'
import * as React from 'react'
import {useTeamsAnnotatedTeam, useTeamsMembers, useTeamsRoleMap} from '@/teams/use-teams-list'

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

type ChatTeamChannelsState = {
  channels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>
  loading: boolean
  teamname: string
}

type ChatTeamNamesState = {
  loading: boolean
  teamnames: ReadonlyMap<T.Teams.TeamID, string>
}

type ChatTeamStateInternal = ChatTeamState & {
  loadedTeamID?: T.Teams.TeamID
}

type ChatTeamMembersStateInternal = ChatTeamMembersState & {
  loadedTeamID?: T.Teams.TeamID
}

type ChatTeamChannelsStateInternal = ChatTeamChannelsState & {
  loadedTeamID?: T.Teams.TeamID
}

type ChatManageChannelsBadgeState = {
  loading: boolean
  showBadge: boolean
}

type ChosenChannelsStoreState = {
  loaded: boolean
  loading: boolean
  teamnames: ReadonlySet<string>
}

const chosenChannelsGregorKey = 'chosenChannelsForTeam'

export type ChatTeam = ChatTeamState & {
  reload: () => Promise<void>
}

export type ChatTeamMembers = ChatTeamMembersState & {
  reload: () => Promise<void>
}

export type ChatTeamChannels = ChatTeamChannelsState & {
  reload: () => Promise<void>
}

export type ChatTeamNames = ChatTeamNamesState & {
  reload: () => Promise<void>
}

export type ChatManageChannelsBadge = ChatManageChannelsBadgeState & {
  dismiss: () => Promise<void>
  reload: () => Promise<void>
}

const emptyMembers = new Map<string, T.Teams.MemberInfo>()
const emptyChannels = new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()
const emptyTeamnames = new Map<T.Teams.TeamID, string>()

const emptyChatTeamState: ChatTeamStateInternal = {
  allowPromote: false,
  description: '',
  loadedTeamID: undefined,
  loading: false,
  role: 'none',
  teamname: '',
  yourOperations: Teams.initialCanUserPerform,
}

const emptyChatTeamChannelsState: ChatTeamChannelsStateInternal = {
  channels: emptyChannels,
  loadedTeamID: undefined,
  loading: false,
  teamname: '',
}

const emptyChatTeamMembersState: ChatTeamMembersStateInternal = {
  loadedTeamID: undefined,
  loading: false,
  members: emptyMembers,
}

const emptyChatTeamNamesState: ChatTeamNamesState = {
  loading: false,
  teamnames: emptyTeamnames,
}

const emptyChosenChannelsTeamnames = new Set<string>()
const emptyChosenChannelsStoreState: ChosenChannelsStoreState = {
  loaded: false,
  loading: false,
  teamnames: emptyChosenChannelsTeamnames,
}

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const parseTeamIDsKey = (teamIDsKey: string): Array<T.Teams.TeamID> =>
  teamIDsKey ? teamIDsKey.split(',').map(teamID => teamID as T.Teams.TeamID) : []

const getChosenChannelsTeams = (
  items: ReadonlyArray<{item?: T.RPCGen.Gregor1.Item | null}> | null | undefined
): Set<string> => {
  const chosenChannels = items?.find(item => item.item?.category === chosenChannelsGregorKey)
  const parsed = bodyToJSON(chosenChannels?.item?.body)
  return new Set(
    Array.isArray(parsed) ? parsed.filter((teamname): teamname is string => typeof teamname === 'string') : []
  )
}

const areStringSetsEqual = (left: ReadonlySet<string>, right: ReadonlySet<string>) => {
  if (left.size !== right.size) {
    return false
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false
    }
  }
  return true
}

const chosenChannelsReloadStaleMs = 30_000

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
  const {loadIfStale: loadAnnotatedTeamIfStale, reload: reloadAnnotatedTeam} = useTeamsAnnotatedTeam()
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

  const load = React.useCallback(async (force: boolean) => {
    if (!enabled || !validTeamID) {
      clearState()
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true, teamname: prev.teamname || teamname || ''}))
    try {
      const [annotatedTeam] = await Promise.all([
        force ? reloadAnnotatedTeam(validTeamID) : loadAnnotatedTeamIfStale(validTeamID),
        loadRoleMapIfStale(),
      ])
      if (!annotatedTeam) {
        throw new Error(`No annotated team returned for ${validTeamID}`)
      }
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
      setState(prev => ({...prev, loading: false, teamname: prev.teamname || teamname || ''}))
    }
  }, [
    clearState,
    enabled,
    loadAnnotatedTeamIfStale,
    loadRoleMapIfStale,
    reloadAnnotatedTeam,
    teamname,
    validTeamID,
  ])

  const reload = React.useCallback(async () => {
    await load(true)
  }, [load])

  const loadIfStale = React.useCallback(async () => {
    await load(false)
  }, [load])

  const visibleState =
    enabled && state.loadedTeamID !== validTeamID
      ? {...emptyChatTeamState, loadedTeamID: validTeamID, teamname: teamname ?? ''}
      : state
  const roleAndDetails = roleAndDetailsFromMap(roleMap, validTeamID ?? T.Teams.noTeamID)
  const yourOperations = React.useMemo(() => Teams.deriveCanPerform(roleAndDetails), [roleAndDetails])

  React.useEffect(() => {
    void loadIfStale()
  }, [loadIfStale])
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      void loadIfStale()
    }, [loadIfStale])
  )
  useEngineActionListener('keybase.1.NotifyTeam.teamMetadataUpdate', () => {
    if (enabled) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamRoleMapChanged', () => {
    if (enabled) {
      void reload()
    }
  })
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

  return {...visibleState, reload, role: roleAndDetails?.role ?? 'none', yourOperations}
}

const useChatTeamMembersRaw = (teamID: T.Teams.TeamID, enabled = true): ChatTeamMembers => {
  const validTeamID = loadableTeamID(teamID)
  const {loadIfStale: loadMembersIfStale, reload: reloadMembers} = useTeamsMembers()
  const [state, setState] = React.useState<ChatTeamMembersStateInternal>({
    ...emptyChatTeamMembersState,
    loadedTeamID: validTeamID,
  })
  const requestVersionRef = React.useRef(0)
  const clearState = React.useCallback(() => {
    requestVersionRef.current++
    setState({...emptyChatTeamMembersState, loadedTeamID: validTeamID})
  }, [validTeamID])

  const load = React.useCallback(async (force: boolean) => {
    if (!enabled || !validTeamID) {
      clearState()
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true}))
    try {
      const members = Teams.rpcDetailsToMemberInfos(
        (force ? await reloadMembers(validTeamID) : await loadMembersIfStale(validTeamID)) ?? []
      )
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
      setState(prev => ({...prev, loading: false}))
    }
  }, [clearState, enabled, loadMembersIfStale, reloadMembers, validTeamID])

  const reload = React.useCallback(async () => {
    await load(true)
  }, [load])

  const loadIfStale = React.useCallback(async () => {
    await load(false)
  }, [load])

  const visibleState =
    enabled && state.loadedTeamID !== validTeamID
      ? {...emptyChatTeamMembersState, loadedTeamID: validTeamID}
      : state

  React.useEffect(() => {
    void loadIfStale()
  }, [loadIfStale])
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      void loadIfStale()
    }, [loadIfStale])
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

const useChatTeamChannelsRaw = (
  teamID: T.Teams.TeamID,
  teamname?: string,
  enabled = true
): ChatTeamChannels => {
  const validTeamID = loadableTeamID(teamID)
  const {loadIfStale: loadAnnotatedTeamIfStale} = useTeamsAnnotatedTeam()
  const [state, setState] = React.useState<ChatTeamChannelsStateInternal>(() => ({
    ...emptyChatTeamChannelsState,
    loadedTeamID: validTeamID,
    teamname: teamname ?? '',
  }))
  const requestVersionRef = React.useRef(0)
  const clearState = React.useCallback(() => {
    requestVersionRef.current++
    setState({...emptyChatTeamChannelsState, loadedTeamID: validTeamID, teamname: teamname ?? ''})
  }, [teamname, validTeamID])

  const reload = React.useCallback(async () => {
    if (!enabled || !validTeamID) {
      clearState()
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true, teamname: prev.teamname || teamname || ''}))
    try {
      const resolvedTeamname = teamname || (await loadAnnotatedTeamIfStale(validTeamID))?.name
      if (!resolvedTeamname) {
        throw new Error(`No teamname returned for ${validTeamID}`)
      }
      const {convs} = await T.RPCChat.localGetTLFConversationsLocalRpcPromise({
        membersType: T.RPCChat.ConversationMembersType.team,
        tlfName: resolvedTeamname,
        topicType: T.RPCChat.TopicType.chat,
      })
      const channels =
        convs?.reduce((res, inboxUIItem) => {
          const conversationIDKey = T.Chat.stringToConversationIDKey(inboxUIItem.convID)
          res.set(conversationIDKey, {
            channelname: inboxUIItem.channel,
            conversationIDKey,
            description: inboxUIItem.headline,
          })
          return res
        }, new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()) ?? emptyChannels
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      setState({channels, loadedTeamID: validTeamID, loading: false, teamname: resolvedTeamname})
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to load chat channels for ${validTeamID}`, error)
      setState(prev => ({...prev, loading: false}))
    }
  }, [clearState, enabled, loadAnnotatedTeamIfStale, teamname, validTeamID])

  const visibleState =
    enabled && state.loadedTeamID !== validTeamID
      ? {...emptyChatTeamChannelsState, loadedTeamID: validTeamID, teamname: teamname ?? ''}
      : state

  React.useEffect(() => {
    void reload()
  }, [reload])
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      void reload()
    }, [reload])
  )
  useEngineActionListener('keybase.1.NotifyTeam.teamMetadataUpdate', () => {
    if (enabled) {
      void reload()
    }
  })
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
  const {loadIfStale: loadAnnotatedTeamIfStale, reload: reloadAnnotatedTeam} = useTeamsAnnotatedTeam()
  const teamIDsKey = [
    ...new Set(teamIDs.map(loadableTeamID).filter((teamID): teamID is T.Teams.TeamID => !!teamID)),
  ]
    .sort()
    .join(',')
  const validTeamIDs = React.useMemo(() => parseTeamIDsKey(teamIDsKey), [teamIDsKey])
  const [state, setState] = React.useState<ChatTeamNamesState>(emptyChatTeamNamesState)
  const requestVersionRef = React.useRef(0)
  const clearState = React.useCallback(() => {
    requestVersionRef.current++
    setState(emptyChatTeamNamesState)
  }, [])

  const load = React.useCallback(async (force: boolean) => {
    if (!enabled || !teamIDsKey || !username) {
      clearState()
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({loading: true, teamnames: new Map(prev.teamnames)}))
    try {
      const resolvedTeamnames = await Promise.all(
        validTeamIDs.map(async teamID => {
          try {
            const teamname = (force ? await reloadAnnotatedTeam(teamID) : await loadAnnotatedTeamIfStale(teamID))
              ?.name
            return teamname ? ([teamID, teamname] as const) : undefined
          } catch (error) {
            logger.warn(`Failed to load chat team name for ${teamID}`, error)
            return undefined
          }
        })
      )
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      const teamnames = new Map<T.Teams.TeamID, string>()
      resolvedTeamnames.forEach(entry => {
        if (entry) {
          teamnames.set(entry[0], entry[1])
        }
      })
      setState({
        loading: false,
        teamnames,
      })
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to load chat team names for ${teamIDsKey}`, error)
      setState(prev => ({loading: false, teamnames: new Map(prev.teamnames)}))
    }
  }, [clearState, enabled, loadAnnotatedTeamIfStale, reloadAnnotatedTeam, teamIDsKey, username, validTeamIDs])

  const reload = React.useCallback(async () => {
    await load(true)
  }, [load])

  const loadIfStale = React.useCallback(async () => {
    await load(false)
  }, [load])

  React.useEffect(() => {
    void loadIfStale()
  }, [loadIfStale])
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      void loadIfStale()
    }, [loadIfStale])
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
        return {loading: false, teamnames}
      })
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && validTeamIDs.includes(action.payload.params.teamID)) {
      requestVersionRef.current++
      setState(prev => {
        const teamnames = new Map(prev.teamnames)
        teamnames.delete(action.payload.params.teamID)
        return {loading: false, teamnames}
      })
    }
  })

  return {...state, reload}
}

type ChatTeamContextValue = {
  members: ChatTeamMembers
  team: ChatTeam
  teamID: T.Teams.TeamID
}

const ChatTeamContext = React.createContext<ChatTeamContextValue | null>(null)

export const ChatTeamProvider = (props: React.PropsWithChildren) => {
  const {children} = props
  const {teamID, teamType, teamname} = ConvoState.useChatContext(
    C.useShallow(s => {
      const {teamID, teamType, teamname} = s.meta
      return {teamID, teamType, teamname}
    })
  )
  const outer = React.useContext(ChatTeamContext)
  const enabled = teamType !== 'adhoc' && !!loadableTeamID(teamID)
  const sameAsOuter = outer?.teamID === teamID
  const team = useChatTeamRaw(teamID, teamname, enabled && !sameAsOuter)
  const members = useChatTeamMembersRaw(teamID, enabled && !sameAsOuter)
  const value: ChatTeamContextValue = sameAsOuter ? outer! : {members, team, teamID}
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

export const useChatTeamChannels = (teamID: T.Teams.TeamID, teamname?: string): ChatTeamChannels =>
  useChatTeamChannelsRaw(teamID, teamname)

export const useChatTeamNames = (teamIDs: ReadonlyArray<T.Teams.TeamID>): ChatTeamNames =>
  useChatTeamNamesRaw(teamIDs)

export const useChatManageChannelsBadge = (
  teamID: T.Teams.TeamID,
  teamname: string
): ChatManageChannelsBadge => {
  const username = useCurrentUserState(s => s.username)
  const validTeamID = loadableTeamID(teamID)
  const [chosenChannelsState, setChosenChannelsState] =
    React.useState<ChosenChannelsStoreState>(emptyChosenChannelsStoreState)
  const chosenChannelsStateRef = React.useRef(chosenChannelsState)
  const chosenChannelsInFlightRef = React.useRef<Promise<void> | undefined>(undefined)
  const chosenChannelsLoadedAtRef = React.useRef(0)

  const updateChosenChannelsState = React.useCallback((nextState: ChosenChannelsStoreState) => {
    const currentState = chosenChannelsStateRef.current
    if (
      currentState.loaded === nextState.loaded &&
      currentState.loading === nextState.loading &&
      areStringSetsEqual(currentState.teamnames, nextState.teamnames)
    ) {
      return
    }
    chosenChannelsStateRef.current = nextState
    if (nextState.loaded) {
      chosenChannelsLoadedAtRef.current = Date.now()
    }
    setChosenChannelsState(nextState)
  }, [])

  const setChosenChannelsFromItems = React.useCallback(
    (items: ReadonlyArray<{item?: T.RPCGen.Gregor1.Item | null}> | null | undefined) => {
      updateChosenChannelsState({
        loaded: true,
        loading: false,
        teamnames: getChosenChannelsTeams(items),
      })
    },
    [updateChosenChannelsState]
  )
  const showBadge =
    !!validTeamID && !!teamname && chosenChannelsState.loaded
      ? !chosenChannelsState.teamnames.has(teamname)
      : false
  const state = {
    loading: !!validTeamID && !!teamname && chosenChannelsState.loading,
    showBadge,
  }

  const reload = React.useCallback(async () => {
    if (!validTeamID || !teamname || !username) {
      updateChosenChannelsState(emptyChosenChannelsStoreState)
      return
    }
    if (chosenChannelsInFlightRef.current) {
      await chosenChannelsInFlightRef.current
      return
    }
    const currentState = chosenChannelsStateRef.current
    updateChosenChannelsState({...currentState, loading: true})
    const request = (async () => {
      try {
        const pushState = await T.RPCGen.gregorGetStateRpcPromise()
        setChosenChannelsFromItems(pushState.items)
      } catch (error) {
        logger.warn('Failed to load chosen channel state', error)
        updateChosenChannelsState({
          ...chosenChannelsStateRef.current,
          loading: false,
        })
      }
    })()
    chosenChannelsInFlightRef.current = request
    try {
      await request
    } finally {
      if (chosenChannelsInFlightRef.current === request) {
        chosenChannelsInFlightRef.current = undefined
      }
    }
  }, [setChosenChannelsFromItems, teamname, updateChosenChannelsState, username, validTeamID])

  const loadIfStale = React.useCallback(
    async (force = false) => {
      if (!validTeamID || !teamname || !username) {
        updateChosenChannelsState(emptyChosenChannelsStoreState)
        return
      }
      const isFresh =
        chosenChannelsStateRef.current.loaded &&
        Date.now() - chosenChannelsLoadedAtRef.current < chosenChannelsReloadStaleMs
      if (!force && isFresh) {
        return
      }
      await reload()
    },
    [reload, teamname, updateChosenChannelsState, username, validTeamID]
  )

  const dismiss = React.useCallback(async () => {
    if (!validTeamID || !teamname) {
      return
    }
    await loadIfStale(true)
    const chosenChannels = new Set(chosenChannelsStateRef.current.teamnames)
    if (chosenChannels.has(teamname)) {
      return
    }
    chosenChannels.add(teamname)
    updateChosenChannelsState({
      loaded: true,
      loading: false,
      teamnames: chosenChannels,
    })
    try {
      await T.RPCGen.gregorUpdateCategoryRpcPromise({
        body: JSON.stringify([...chosenChannels]),
        category: chosenChannelsGregorKey,
        dtime: {offset: 0, time: 0},
      })
    } catch (error) {
      logger.warn(`Failed to update chosen channel state for ${teamname}`, error)
      await loadIfStale(true)
    }
  }, [loadIfStale, teamname, updateChosenChannelsState, validTeamID])

  React.useEffect(() => {
    void loadIfStale()
  }, [loadIfStale])
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      if (validTeamID && teamname) {
        void loadIfStale()
      }
    }, [loadIfStale, teamname, validTeamID])
  )
  useEngineActionListener('keybase.1.gregorUI.pushState', action => {
    if (validTeamID && teamname) {
      setChosenChannelsFromItems(action.payload.params.state.items)
    }
  })

  return {...state, dismiss, reload}
}
