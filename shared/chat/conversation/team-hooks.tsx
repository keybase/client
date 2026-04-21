import * as C from '@/constants'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import * as ConvoState from '@/stores/convostate'
import * as Teams from '@/stores/teams'
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

export type ChatTeam = ChatTeamState & {
  reload: () => Promise<void>
}

export type ChatTeamMembers = ChatTeamMembersState & {
  reload: () => Promise<void>
}

export type ChatTeamChannels = ChatTeamChannelsState & {
  reload: () => Promise<void>
}

const emptyMembers = new Map<string, T.Teams.MemberInfo>()
const emptyChannels = new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()

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

const annotatedTeamToChatTeamState = (
  annotatedTeam: T.RPCGen.AnnotatedTeam,
  roleAndDetails: T.Teams.TeamRoleAndDetails | undefined
): ChatTeamState => ({
  description: annotatedTeam.showcase.description ?? '',
  loading: false,
  role: roleAndDetails?.role ?? 'none',
  teamname: annotatedTeam.name ?? '',
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
  const [state, setState] = React.useState<ChatTeamMembersState>(emptyChatTeamMembersState)
  const requestVersionRef = React.useRef(0)

  const reload = React.useCallback(async () => {
    if (!enabled || !validTeamID) {
      setState(emptyChatTeamMembersState)
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true}))
    try {
      const members = Teams.rpcDetailsToMemberInfos(
        (await T.RPCGen.teamsTeamGetMembersByIDRpcPromise({id: validTeamID})) ?? []
      )
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      setState({loading: false, members})
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to load chat team members for ${validTeamID}`, error)
      setState(prev => ({...prev, loading: false}))
    }
  }, [enabled, validTeamID])

  React.useEffect(() => {
    void reload()
  }, [reload])
  C.Router2.useSafeFocusEffect(() => {
    void reload()
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamChangedByID', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      void reload()
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamDeleted', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      setState(emptyChatTeamMembersState)
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      setState(emptyChatTeamMembersState)
    }
  })

  return {...state, reload}
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
  const value = sameAsOuter && outer ? outer : {members, team, teamID}
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
