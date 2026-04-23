import * as C from '@/constants'
import * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import logger from '@/logger'
import * as React from 'react'
import {useTeamsAnnotatedTeam} from '../use-teams-list'

type LoadedTeamChannels = {
  channels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>
  loading: boolean
  reload: () => Promise<void>
}

type LoadedTeamChannelsContextValue = LoadedTeamChannels & {
  teamID: T.Teams.TeamID
}

type LoadedTeamChannelsState = Omit<LoadedTeamChannels, 'reload'> & {
  loadedTeamID?: T.Teams.TeamID
}

const LoadedTeamChannelsContext = React.createContext<LoadedTeamChannelsContextValue | null>(null)

const emptyChannels: ReadonlyMap<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo> = new Map()

const loadableTeamID = (teamID: T.Teams.TeamID) =>
  teamID && teamID !== T.Teams.noTeamID && teamID !== T.Teams.newTeamWizardTeamID ? teamID : undefined

const emptyLoadedTeamChannelsState = (
  loading = false,
  teamID?: T.Teams.TeamID
): LoadedTeamChannelsState => ({
  channels: emptyChannels,
  loadedTeamID: teamID,
  loading,
})

const loadTeamname = async (
  teamID: T.Teams.TeamID,
  loadAnnotatedTeamIfStale: (teamID: T.Teams.TeamID) => Promise<T.RPCGen.AnnotatedTeam | undefined>,
  teamname?: string
) => {
  if (teamname) {
    return teamname
  }
  const annotatedTeam = await loadAnnotatedTeamIfStale(teamID)
  return annotatedTeam?.name
}

const useLoadedTeamChannelsRaw = (
  teamID: T.Teams.TeamID,
  providedTeamname?: string,
  enabled = true
): LoadedTeamChannels => {
  const validTeamID = loadableTeamID(teamID)
  const {loadIfStale: loadAnnotatedTeamIfStale} = useTeamsAnnotatedTeam()
  const [state, setState] = React.useState<LoadedTeamChannelsState>(
    emptyLoadedTeamChannelsState(enabled && !!validTeamID, validTeamID)
  )
  const requestVersionRef = React.useRef(0)
  const clearState = React.useCallback(
    (loading = false, nextTeamID?: T.Teams.TeamID) => {
      requestVersionRef.current++
      setState(emptyLoadedTeamChannelsState(loading, nextTeamID))
    },
    [setState]
  )

  const reload = React.useCallback(async () => {
    if (!enabled || !validTeamID) {
      clearState()
      return
    }
    const requestVersion = ++requestVersionRef.current
    setState(prev => ({...prev, loading: true}))
    try {
      const teamname = await loadTeamname(validTeamID, loadAnnotatedTeamIfStale, providedTeamname)
      if (!teamname) {
        throw new Error(`No teamname returned for ${validTeamID}`)
      }
      const {convs} = await T.RPCChat.localGetTLFConversationsLocalRpcPromise(
        {
          membersType: T.RPCChat.ConversationMembersType.team,
          tlfName: teamname,
          topicType: T.RPCChat.TopicType.chat,
        },
        C.waitingKeyTeamsGetChannels(validTeamID)
      )
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      const channels =
        convs?.reduce((res, inboxUIItem) => {
          const conversationIDKey = T.Chat.stringToConversationIDKey(inboxUIItem.convID)
          res.set(conversationIDKey, {
            channelname: inboxUIItem.channel,
            conversationIDKey,
            description: inboxUIItem.headline,
          })
          return res
        }, new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()) ??
        new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()

      for (const channel of channels.values()) {
        C.ignorePromise(
          T.RPCChat.localRefreshParticipantsRpcPromise({
            convID: T.Chat.keyToConversationID(channel.conversationIDKey),
          })
        )
      }

      setState({
        channels,
        loadedTeamID: validTeamID,
        loading: false,
      })
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) {
        return
      }
      logger.warn(`Failed to load team channels for ${validTeamID}`, error)
      setState(prev => ({...prev, loading: false}))
    }
  }, [clearState, enabled, loadAnnotatedTeamIfStale, providedTeamname, validTeamID])

  const visibleState =
    enabled && state.loadedTeamID !== validTeamID ? emptyLoadedTeamChannelsState(false, validTeamID) : state

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
      clearState(false, validTeamID)
    }
  })
  useEngineActionListener('keybase.1.NotifyTeam.teamExit', action => {
    if (enabled && action.payload.params.teamID === validTeamID) {
      clearState(false, validTeamID)
    }
  })

  return {...visibleState, reload}
}

export const LoadedTeamChannelsProvider = (
  props: React.PropsWithChildren<{teamID: T.Teams.TeamID; teamname?: string}>
) => {
  const {children, teamID, teamname} = props
  const loadedTeamChannels = useLoadedTeamChannelsRaw(teamID, teamname)
  const value = {...loadedTeamChannels, teamID}
  return <LoadedTeamChannelsContext.Provider value={value}>{children}</LoadedTeamChannelsContext.Provider>
}

export const useLoadedTeamChannels = (
  teamID: T.Teams.TeamID,
  teamname?: string
): LoadedTeamChannels => {
  const context = React.useContext(LoadedTeamChannelsContext)
  const useContextValue = context?.teamID === teamID
  const raw = useLoadedTeamChannelsRaw(teamID, teamname, !useContextValue)
  return useContextValue ? context : raw
}
