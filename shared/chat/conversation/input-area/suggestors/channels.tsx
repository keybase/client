import * as C from '@/constants'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import * as Common from './common'
import * as Kb from '@/common-adapters'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {useCurrentUserState} from '@/stores/current-user'
import * as React from 'react'
import {useConversationMetadata} from '../../data-hooks'
import {useMutualTeams} from '@/util/use-mutual-teams'

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

// a bare channel row is a single line of BodySemibold, whose desktop line-height is 18
const bareChannelRowHeight = Common.desktopRowHeight(18)

const ItemRenderer = (p: Common.ItemRendererProps<ChannelType>) => {
  const styles = Common.useStyles()
  const theme = Kb.Styles.useTheme()
  const {item, selected} = p
  const {channelname, teamname} = item
  return teamname ? (
    <Common.TeamSuggestion teamname={teamname} channelname={channelname} selected={selected} />
  ) : (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([
        styles.suggestionBase,
        styles.fixSuggestionHeight,
        {backgroundColor: selected ? theme.blueLighter2 : theme.white},
      ])}
    >
      <Kb.Text type="BodySemibold">#{channelname}</Kb.Text>
    </Kb.Box2>
  )
}

const noChannel: Array<{channelname: string}> = []
const noMutualTeams: ReadonlyArray<T.RPCChat.SharedTeam> = []
const noParticipants: ReadonlyArray<string> = []

const useConversationMutualTeams = (
  conversationIDKey: T.Chat.ConversationIDKey,
  meta: T.Immutable<T.Chat.ConversationMeta>,
  participants: T.Immutable<T.Chat.ParticipantInfo>
) => {
  const username = useCurrentUserState(s => s.username)
  const shouldLoad = !meta.teamname
  const otherParticipants = React.useMemo(
    () => (shouldLoad ? Meta.getRowParticipants(participants, username || '') : noParticipants),
    [participants, shouldLoad, username]
  )
  const {teams} = useMutualTeams(
    otherParticipants,
    C.waitingKeyChatMutualTeams(conversationIDKey),
    shouldLoad
  )
  return shouldLoad ? teams : noMutualTeams
}

const getChannelSuggestions = (teamname: string, mutualTeams: ReadonlyArray<T.RPCChat.SharedTeam>) => {
  if (!teamname) {
    const mutualTeamnames = new Set(mutualTeams.map(team => team.name))
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
  const mutualTeams = useConversationMutualTeams(conversationIDKey, meta, participants)
  const {teamID} = meta

  const suggestChannelsLoading = C.Waiting.useAnyWaiting([
    C.waitingKeyTeamsGetChannels(teamID),
    C.waitingKeyChatMutualTeams(conversationIDKey),
  ])
  const fil = filter.toLowerCase()
  // don't include 'small' here to ditch the single #general suggestion
  const teamname = meta.teamType === 'big' ? meta.teamname : ''
  const suggestChannels = getChannelSuggestions(teamname, mutualTeams)

  // TODO this will thrash always
  return {
    items: suggestChannels.filter(ch => ch.channelname.toLowerCase().includes(fil)),
    loading: suggestChannelsLoading,
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
  // suggestions are either all mutual-team channels or all bare channels, never mixed
  const rowHeight = items.some(i => 'teamname' in i && i.teamname)
    ? Common.avatarRowHeight
    : bareChannelRowHeight
  return (
    <Common.List
      {...rest}
      keyExtractor={keyExtractor}
      items={items}
      ItemRenderer={ItemRenderer}
      loading={loading}
      rowHeight={rowHeight}
    />
  )
}
