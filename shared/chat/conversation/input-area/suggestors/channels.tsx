import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as T from '@/constants/types'
import * as Teams from '@/stores/teams'
import * as Common from './common'
import * as Kb from '@/common-adapters'

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
const getChannelSuggestions = (
  s: Chat.ConvoState,
  teamname: string,
  teamMeta: Teams.State['teamMeta']
) => {
  if (!teamname) {
    // this is an impteam, so get mutual teams from state
    const mutualTeams = s.mutualTeams.map(teamID => teamMeta.get(teamID)?.teamname)
    if (!mutualTeams.length) {
      return noChannel
    }
    // TODO not reactive
    const suggestions = (Chat.useChatState.getState().inboxLayout?.bigTeams ?? []).reduce<
      Array<{channelname: string; teamname: string}>
    >((arr, t) => {
      t.state === T.RPCChat.UIInboxBigTeamRowTyp.channel &&
        mutualTeams.includes(t.channel.teamname) &&
        arr.push({channelname: t.channel.channelname, teamname: t.channel.teamname})
      return arr
    }, [])

    return suggestions
  }
  // TODO: get all the channels in the team, too, for this
  // TODO not reactive
  const suggestions = (Chat.useChatState.getState().inboxLayout?.bigTeams ?? []).reduce<
    Array<{channelname: string}>
  >((arr, t) => {
    t.state === T.RPCChat.UIInboxBigTeamRowTyp.channel &&
      t.channel.teamname === teamname &&
      arr.push({channelname: t.channel.channelname})
    return arr
  }, [])

  return suggestions
}

const useDataSource = (filter: string) => {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const meta = Chat.useChatContext(s => s.meta)
  const {teamID} = meta

  const suggestChannelsLoading = C.Waiting.useAnyWaiting([
    C.waitingKeyTeamsGetChannels(teamID),
    C.waitingKeyChatMutualTeams(conversationIDKey),
  ])
  const teamMeta = Teams.useTeamsState(s => s.teamMeta)
  return Chat.useChatContext(
    C.useDeep(s => {
      const fil = filter.toLowerCase()
      // don't include 'small' here to ditch the single #general suggestion
      const teamname = meta.teamType === 'big' ? meta.teamname : ''
      const suggestChannels = getChannelSuggestions(s, teamname, teamMeta)

      // TODO this will thrash always
      return {
        items: suggestChannels.filter(ch => ch.channelname.toLowerCase().includes(fil)).sort(),
        loading: suggestChannelsLoading,
      }
    })
  )
}
type ChannelType = {
  channelname: string
  teamname?: string
}
type ListProps = Pick<
  Common.ListProps<ChannelType>,
  'expanded' | 'suggestBotCommandsUpdateStatus' | 'listStyle' | 'spinnerStyle'
> & {
  filter: string
  onSelected: (item: ChannelType, final: boolean) => void
  setOnMoveRef: (r: (up: boolean) => void) => void
  setOnSubmitRef: (r: () => boolean) => void
}
export const List = (p: ListProps) => {
  const {filter, ...rest} = p
  const {items, loading} = useDataSource(filter)
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
