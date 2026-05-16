import * as C from '@/constants'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import * as Common from './common'
import * as Kb from '@/common-adapters'
import {useChatTeamNames} from '../../team-hooks'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {useCurrentUserState} from '@/stores/current-user'
import * as React from 'react'
import {useConversationMetadata} from '../../data-hooks'

export const transformer = (
  {channelname, teamname}: {channelname: string; teamname?: string},
  marker: string,
  tData: Common.TransformerData,
  preview: boolean
) =>
  Common.standardTransformer(
    teamname ? `@${teamname}${marker}${channelname}` : `${marker}${channelname}`,
    tData,
    preview
  )

const keyExtractor = ({channelname, teamname}: ChannelType) =>
  teamname ? `${teamname}#${channelname}` : channelname

const ItemRenderer = (p: Common.ItemRendererProps<ChannelType>) => {
  const {item, selected} = p
  const {channelname, teamname} = item
  return teamname ? (
    <Common.TeamSuggestion teamname={teamname} channelname={channelname} selected={selected} />
  ) : (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([
        Common.styles.suggestionBase,
        Common.styles.fixSuggestionHeight,
        {backgroundColor: selected ? Kb.Styles.globalColors.blueLighter2 : Kb.Styles.globalColors.white},
      ])}
    >
      <Kb.Text type="BodySemibold">#{channelname}</Kb.Text>
    </Kb.Box2>
  )
}

const noChannel: Array<{channelname: string}> = []
const noMutualTeams: ReadonlyArray<T.Teams.TeamID> = []

const useMutualTeams = (
  conversationIDKey: T.Chat.ConversationIDKey,
  meta: T.Immutable<T.Chat.ConversationMeta>,
  participants: T.Immutable<T.Chat.ParticipantInfo>
) => {
  const username = useCurrentUserState(s => s.username)
  const [loaded, setLoaded] = React.useState<
    | {
        conversationIDKey: T.Chat.ConversationIDKey
        teamIDs: ReadonlyArray<T.Teams.TeamID>
      }
    | undefined
  >()
  const loadMutualTeams = C.useRPC(T.RPCChat.localGetMutualTeamsLocalRpcPromise)
  const requestIDRef = React.useRef(0)
  const shouldLoad = !meta.teamname

  React.useEffect(() => {
    requestIDRef.current += 1
    if (!shouldLoad) {
      return undefined
    }
    const requestID = requestIDRef.current
    const otherParticipants = Meta.getRowParticipants(participants, username || '')
    loadMutualTeams(
      [{usernames: otherParticipants}, C.waitingKeyChatMutualTeams(conversationIDKey)],
      results => {
        if (requestIDRef.current !== requestID) {
          return
        }
        setLoaded({conversationIDKey, teamIDs: results.teamIDs ?? noMutualTeams})
      },
      () => {
        if (requestIDRef.current !== requestID) {
          return
        }
        setLoaded({conversationIDKey, teamIDs: noMutualTeams})
      }
    )
    return () => {
      if (requestIDRef.current === requestID) {
        requestIDRef.current += 1
      }
    }
  }, [conversationIDKey, loadMutualTeams, participants, shouldLoad, username])

  return shouldLoad && loaded?.conversationIDKey === conversationIDKey ? loaded.teamIDs : noMutualTeams
}

const getChannelSuggestions = (
  teamname: string,
  mutualTeams: ReadonlyArray<T.Teams.TeamID>,
  mutualTeamnamesByID: ReadonlyMap<T.Teams.TeamID, string>
) => {
  if (!teamname) {
    const mutualTeamnames = new Set(
      mutualTeams
        .map(teamID => mutualTeamnamesByID.get(teamID))
        .filter((maybeTeamname): maybeTeamname is string => !!maybeTeamname)
    )
    if (!mutualTeamnames.size) {
      return noChannel
    }
    // TODO not reactive
    const suggestions = (useInboxLayoutState.getState().layout?.bigTeams ?? []).reduce<
      Array<{channelname: string; teamname: string}>
    >((arr, t) => {
      if (t.state === T.RPCChat.UIInboxBigTeamRowTyp.channel && mutualTeamnames.has(t.channel.teamname)) {
        arr.push({channelname: t.channel.channelname, teamname: t.channel.teamname})
      }
      return arr
    }, [])

    return suggestions
  }
  // TODO: get all the channels in the team, too, for this
  // TODO not reactive
  const suggestions = (useInboxLayoutState.getState().layout?.bigTeams ?? []).reduce<
    Array<{channelname: string}>
  >((arr, t) => {
    if (t.state === T.RPCChat.UIInboxBigTeamRowTyp.channel && t.channel.teamname === teamname) {
      arr.push({channelname: t.channel.channelname})
    }
    return arr
  }, [])

  return suggestions
}

const useDataSource = (conversationIDKey: T.Chat.ConversationIDKey, filter: string) => {
  const {meta, participants} = useConversationMetadata(conversationIDKey)
  const mutualTeams = useMutualTeams(conversationIDKey, meta, participants)
  const {teamnames: mutualTeamnamesByID, loading: loadingMutualTeamnames} = useChatTeamNames(mutualTeams)
  const {teamID} = meta

  const suggestChannelsLoading = C.Waiting.useAnyWaiting([
    C.waitingKeyTeamsGetChannels(teamID),
    C.waitingKeyChatMutualTeams(conversationIDKey),
  ])
  const fil = filter.toLowerCase()
  // don't include 'small' here to ditch the single #general suggestion
  const teamname = meta.teamType === 'big' ? meta.teamname : ''
  const suggestChannels = getChannelSuggestions(teamname, mutualTeams, mutualTeamnamesByID)

  // TODO this will thrash always
  return {
    items: suggestChannels.filter(ch => ch.channelname.toLowerCase().includes(fil)),
    loading: suggestChannelsLoading || loadingMutualTeamnames,
  }
}
type ChannelType = {
  channelname: string
  teamname?: string
}
type ListProps = Pick<
  Common.ListProps<ChannelType>,
  'suggestBotCommandsUpdateStatus' | 'listStyle' | 'spinnerStyle'
> & {
  conversationIDKey: T.Chat.ConversationIDKey
  filter: string
  onSelected: (item: ChannelType, final: boolean) => void
  setOnMoveRef: (r: (up: boolean) => void) => void
  setOnSubmitRef: (r: () => boolean) => void
}
export const List = (p: ListProps) => {
  const {conversationIDKey, filter, ...rest} = p
  const {items, loading} = useDataSource(conversationIDKey, filter)
  return (
    <Common.List
      {...rest}
      keyExtractor={keyExtractor}
      items={items}
      ItemRenderer={ItemRenderer}
      loading={loading}
    />
  )
}
