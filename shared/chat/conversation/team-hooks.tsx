import * as C from '@/constants'
import {bodyToJSON} from '@/constants/rpc-utils'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import * as ConvoState from '@/stores/convostate'
import {useCurrentUserState} from '@/stores/current-user'
import * as Teams from '@/stores/teams'
import {useLoadTeamMembers} from '@/teams/team-members'
import logger from '@/logger'
import * as React from 'react'

type ChatTeamState = {
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

const emptyChatTeamState: ChatTeamState = {
  description: '',
  loading: false,
  role: 'none',
  teamname: '',
  yourOperations: Teams.initialCanUserPerform,
}

const emptyChatTeamMembersState: ChatTeamMembersState = {
  loading: false,
  members: emptyMembers,
}

const emptyChatTeamChannelsState: ChatTeamChannelsState = {
  channels: emptyChannels,
  loading: false,
  teamname: '',
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
  return new Set(Array.isArray(parsed) ? parsed.filter((teamname): teamname is string => typeof teamname === 'string') : [])
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

let chosenChannelsStoreState = emptyChosenChannelsStoreState
let chosenChannelsInFlight: Promise<void> | undefined
let chosenChannelsLoadedAt = 0
const chosenChannelsListeners = new Set<() => void>()
const chosenChannelsReloadStaleMs = 30_000

const subscribeChosenChannelsStore = (listener: () => void) => {
  chosenChannelsListeners.add(listener)
  return () => {
    chosenChannelsListeners.delete(listener)
  }
}

const notifyChosenChannelsStore = () => {
  chosenChannelsListeners.forEach(listener => listener())
}

const setChosenChannelsStoreState = (nextState: ChosenChannelsStoreState) => {
  if (
    chosenChannelsStoreState.loaded === nextState.loaded &&
    chosenChannelsStoreState.loading === nextState.loading &&
    areStringSetsEqual(chosenChannelsStoreState.teamnames, nextState.teamnames)
  ) {
    return
  }
  chosenChannelsStoreState = nextState
  if (nextState.loaded) {
    chosenChannelsLoadedAt = Date.now()
  }
  notifyChosenChannelsStore()
}

const setChosenChannelsStoreFromItems = (
  items: ReadonlyArray<{item?: T.RPCGen.Gregor1.Item | null}> | null | undefined
) => {
  setChosenChannelsStoreState({
    loaded: true,
    loading: false,
    teamnames: getChosenChannelsTeams(items),
  })
}

const getChosenChannelsStoreState = () => chosenChannelsStoreState

const resetChosenChannelsStore = () => {
  chosenChannelsStoreState = emptyChosenChannelsStoreState
  chosenChannelsInFlight = undefined
  chosenChannelsLoadedAt = 0
}

const loadChosenChannelsStore = async (force = false) => {
  if (chosenChannelsInFlight) {
    return chosenChannelsInFlight
  }
  const isFresh =
    chosenChannelsStoreState.loaded && Date.now() - chosenChannelsLoadedAt < chosenChannelsReloadStaleMs
  if (!force && isFresh) {
    return
  }
  setChosenChannelsStoreState({
    ...chosenChannelsStoreState,
    loading: true,
  })
  const request = (async () => {
    try {
      const pushState = await T.RPCGen.gregorGetStateRpcPromise()
      setChosenChannelsStoreFromItems(pushState.items)
    } catch (error) {
      logger.warn('Failed to load chosen channel state', error)
      setChosenChannelsStoreState({
        ...chosenChannelsStoreState,
        loading: false,
      })
    }
  })()
  chosenChannelsInFlight = request
  try {
    return await request
  } finally {
    if (chosenChannelsInFlight === request) {
      chosenChannelsInFlight = undefined
    }
  }
}

const setChosenChannelsTeamDismissed = (teamname: string) => {
  if (!teamname) {
    return
  }
  const nextTeamnames = new Set(chosenChannelsStoreState.teamnames)
  nextTeamnames.add(teamname)
  setChosenChannelsStoreState({
    loaded: true,
    loading: false,
    teamnames: nextTeamnames,
  })
}

let chatTeamnameVersion = 0
const chatTeamnameCache = new Map<T.Teams.TeamID, string>()
const chatTeamnameRequests = new Map<T.Teams.TeamID, Promise<string>>()
const chatTeamnameVersions = new Map<T.Teams.TeamID, number>()

const resetChatTeamnameCache = () => {
  chatTeamnameVersion += 1
  chatTeamnameCache.clear()
  chatTeamnameRequests.clear()
  chatTeamnameVersions.clear()
}

const invalidateChatTeamname = (teamID: T.Teams.TeamID) => {
  chatTeamnameVersion += 1
  chatTeamnameCache.delete(teamID)
  chatTeamnameRequests.delete(teamID)
  chatTeamnameVersions.set(teamID, chatTeamnameVersion)
}

const invalidateChatTeamnames = (teamIDs: ReadonlyArray<T.Teams.TeamID>) => {
  teamIDs.forEach(invalidateChatTeamname)
}

const getCachedChatTeamnames = (teamIDs: ReadonlyArray<T.Teams.TeamID>) =>
  teamIDs.reduce((teamnames, teamID) => {
    const teamname = chatTeamnameCache.get(teamID)
    if (teamname) {
      teamnames.set(teamID, teamname)
    }
    return teamnames
  }, new Map<T.Teams.TeamID, string>())

const loadChatTeamname = async (teamID: T.Teams.TeamID) => {
  const cachedTeamname = chatTeamnameCache.get(teamID)
  if (cachedTeamname) {
    return cachedTeamname
  }
  const existing = chatTeamnameRequests.get(teamID)
  if (existing) {
    return existing
  }
  const version = chatTeamnameVersions.get(teamID) ?? 0
  const request = (async () => {
    const teamname = (await T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID})).name
    if (teamname && (chatTeamnameVersions.get(teamID) ?? 0) === version) {
      chatTeamnameCache.set(teamID, teamname)
    }
    return teamname
  })()
  chatTeamnameRequests.set(teamID, request)
  try {
    return await request
  } finally {
    if (chatTeamnameRequests.get(teamID) === request) {
      chatTeamnameRequests.delete(teamID)
    }
  }
}

let chatTeamHooksUsername = ''

const ensureChatTeamHooksUser = (username: string) => {
  if (chatTeamHooksUsername === username) {
    return
  }
  chatTeamHooksUsername = username
  resetChosenChannelsStore()
  resetChatTeamnameCache()
}

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
  description: annotatedTeam.showcase.description ?? '',
  loading: false,
  role: roleAndDetails?.role ?? 'none',
  teamname: annotatedTeam.name,
  yourOperations: Teams.deriveCanPerform(roleAndDetails),
})

const useChatTeamRaw = (teamID: T.Teams.TeamID, teamname?: string, enabled = true): ChatTeam => {
  const validTeamID = loadableTeamID(teamID)
  const [state, setState] = React.useState<ChatTeamState>(() => ({
    ...emptyChatTeamState,
    teamname: teamname ?? '',
  }))
  const requestVersionRef = React.useRef(0)

  const reload = React.useCallback(async () => {
    if (!enabled || !validTeamID) {
      setState({...emptyChatTeamState, teamname: teamname ?? ''})
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true, teamname: prev.teamname || teamname || ''}))
    try {
      const [annotatedTeam, roleMap] = await Promise.all([
        T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID: validTeamID}),
        T.RPCGen.teamsGetTeamRoleMapRpcPromise(),
      ])
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      setState(annotatedTeamToChatTeamState(annotatedTeam, roleAndDetailsFromMap(roleMap, validTeamID)))
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to load chat team metadata for ${validTeamID}`, error)
      setState(prev => ({...prev, loading: false, teamname: prev.teamname || teamname || ''}))
    }
  }, [enabled, teamname, validTeamID])

  React.useEffect(() => {
    void reload()
  }, [reload])
  C.Router2.useSafeFocusEffect(() => {
    void reload()
  })
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
      setState({...emptyChatTeamState, teamname: teamname ?? ''})
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      setState({...emptyChatTeamState, teamname: teamname ?? ''})
    }
  })

  return {...state, reload}
}

const useChatTeamMembersRaw = (
  teamID: T.Teams.TeamID,
  enabled = true
): ChatTeamMembers => {
  const validTeamID = loadableTeamID(teamID)
  useLoadTeamMembers(teamID, enabled)
  const {getMembers, loadedMembers} = Teams.useTeamsState(
    C.useShallow(s => ({
      getMembers: s.dispatch.getMembers,
      loadedMembers: validTeamID ? s.teamIDToMembers.get(validTeamID) : undefined,
    }))
  )
  const members = enabled && validTeamID ? (loadedMembers ?? emptyMembers) : emptyMembers
  const loading = enabled && !!validTeamID && !loadedMembers

  const reload = React.useCallback(async () => {
    if (!enabled || !validTeamID) {
      return
    }
    try {
      await getMembers(validTeamID, true)
    } catch (error) {
      logger.warn(`Failed to reload chat team members for ${validTeamID}`, error)
    }
  }, [enabled, getMembers, validTeamID])

  return {loading, members, reload}
}

const useChatTeamChannelsRaw = (
  teamID: T.Teams.TeamID,
  teamname?: string,
  enabled = true
): ChatTeamChannels => {
  const validTeamID = loadableTeamID(teamID)
  const [state, setState] = React.useState<ChatTeamChannelsState>(() => ({
    ...emptyChatTeamChannelsState,
    teamname: teamname ?? '',
  }))
  const requestVersionRef = React.useRef(0)

  const reload = React.useCallback(async () => {
    if (!enabled || !validTeamID) {
      setState({...emptyChatTeamChannelsState, teamname: teamname ?? ''})
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true, teamname: prev.teamname || teamname || ''}))
    try {
      const resolvedTeamname = teamname || (await T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID: validTeamID})).name
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
      setState({channels, loading: false, teamname: resolvedTeamname})
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to load chat channels for ${validTeamID}`, error)
      setState(prev => ({...prev, loading: false}))
    }
  }, [enabled, teamname, validTeamID])

  React.useEffect(() => {
    void reload()
  }, [reload])
  C.Router2.useSafeFocusEffect(() => {
    void reload()
  })
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
      setState({...emptyChatTeamChannelsState, teamname: teamname ?? ''})
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      setState({...emptyChatTeamChannelsState, teamname: teamname ?? ''})
    }
  })

  return {...state, reload}
}

const useChatTeamNamesRaw = (
  teamIDs: ReadonlyArray<T.Teams.TeamID>,
  enabled = true
): ChatTeamNames => {
  const username = useCurrentUserState(s => s.username)
  ensureChatTeamHooksUser(username)
  const teamIDsKey = [...new Set(teamIDs.map(loadableTeamID).filter((teamID): teamID is T.Teams.TeamID => !!teamID))]
    .sort()
    .join(',')
  const validTeamIDs = React.useMemo(() => parseTeamIDsKey(teamIDsKey), [teamIDsKey])
  const [state, setState] = React.useState<ChatTeamNamesState>(emptyChatTeamNamesState)
  const requestVersionRef = React.useRef(0)

  const reload = React.useCallback(async () => {
    if (!enabled || !teamIDsKey) {
      setState(emptyChatTeamNamesState)
      return
    }
    const requestVersion = ++requestVersionRef.current
    const cachedTeamnames = getCachedChatTeamnames(validTeamIDs)
    const missingTeamIDs = validTeamIDs.filter(teamID => !cachedTeamnames.has(teamID))
    if (!missingTeamIDs.length) {
      setState({loading: false, teamnames: cachedTeamnames})
      return
    }
    setState({loading: true, teamnames: cachedTeamnames})
    try {
      await Promise.all(missingTeamIDs.map(loadChatTeamname))
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      setState({
        loading: false,
        teamnames: getCachedChatTeamnames(validTeamIDs),
      })
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to load chat team names for ${teamIDsKey}`, error)
      setState({loading: false, teamnames: getCachedChatTeamnames(validTeamIDs)})
    }
  }, [enabled, teamIDsKey, validTeamIDs])

  React.useEffect(() => {
    void reload()
  }, [reload])
  C.Router2.useSafeFocusEffect(() => {
    void reload()
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamMetadataUpdate', () => {
    if (enabled && teamIDsKey) {
      invalidateChatTeamnames(validTeamIDs)
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled && validTeamIDs.includes(action.payload.params.teamID)) {
      invalidateChatTeamname(action.payload.params.teamID)
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled && validTeamIDs.includes(action.payload.params.teamID)) {
      invalidateChatTeamname(action.payload.params.teamID)
      setState(prev => {
        const teamnames = new Map(prev.teamnames)
        teamnames.delete(action.payload.params.teamID)
        return {loading: false, teamnames}
      })
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && validTeamIDs.includes(action.payload.params.teamID)) {
      invalidateChatTeamname(action.payload.params.teamID)
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

export const useChatTeamChannels = (
  teamID: T.Teams.TeamID,
  teamname?: string
): ChatTeamChannels => useChatTeamChannelsRaw(teamID, teamname)

export const useChatTeamNames = (teamIDs: ReadonlyArray<T.Teams.TeamID>): ChatTeamNames =>
  useChatTeamNamesRaw(teamIDs)

export const useChatManageChannelsBadge = (
  teamID: T.Teams.TeamID,
  teamname: string
): ChatManageChannelsBadge => {
  const username = useCurrentUserState(s => s.username)
  ensureChatTeamHooksUser(username)
  const validTeamID = loadableTeamID(teamID)
  const chosenChannelsState = React.useSyncExternalStore(
    subscribeChosenChannelsStore,
    getChosenChannelsStoreState,
    getChosenChannelsStoreState
  )
  const showBadge =
    !!validTeamID && !!teamname && chosenChannelsState.loaded ? !chosenChannelsState.teamnames.has(teamname) : false
  const state = {
    loading: !!validTeamID && !!teamname && chosenChannelsState.loading,
    showBadge,
  }

  const reload = React.useCallback(async () => {
    if (!validTeamID || !teamname) {
      return
    }
    await loadChosenChannelsStore(true)
  }, [teamname, validTeamID])

  const dismiss = React.useCallback(async () => {
    if (!validTeamID || !teamname) {
      return
    }
    await loadChosenChannelsStore(true)
    const chosenChannels = new Set(getChosenChannelsStoreState().teamnames)
    if (chosenChannels.has(teamname)) {
      return
    }
    chosenChannels.add(teamname)
    setChosenChannelsTeamDismissed(teamname)
    try {
      await T.RPCGen.gregorUpdateCategoryRpcPromise({
        body: JSON.stringify([...chosenChannels]),
        category: chosenChannelsGregorKey,
        dtime: {offset: 0, time: 0},
      })
    } catch (error) {
      logger.warn(`Failed to update chosen channel state for ${teamname}`, error)
      await loadChosenChannelsStore(true)
    }
  }, [teamname, validTeamID])

  React.useEffect(() => {
    if (!validTeamID || !teamname) {
      return
    }
    void loadChosenChannelsStore()
  }, [teamname, validTeamID])
  C.Router2.useSafeFocusEffect(() => {
    if (validTeamID && teamname) {
      void loadChosenChannelsStore()
    }
  })
  useEngineActionListener('keybase.1.gregorUI.pushState', action => {
    setChosenChannelsStoreFromItems(action.payload.params.state.items)
  })

  return {...state, dismiss, reload}
}
