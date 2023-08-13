import * as C from '../../../../constants'
import * as React from 'react'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Constants from '../../../../constants/chat2'
import * as TeamsConstants from '../../../../constants/teams'
import * as Common from './common'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import type * as Types from '../../../../constants/types/chat2'
import isEqual from 'lodash/isEqual'

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

export const keyExtractor = ({channelname, teamname}: ChannelType) =>
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
      style={Styles.collapseStyles([
        Common.styles.suggestionBase,
        Common.styles.fixSuggestionHeight,
        {backgroundColor: selected ? Styles.globalColors.blueLighter2 : Styles.globalColors.white},
      ])}
    >
      <Kb.Text type="BodySemibold">#{channelname}</Kb.Text>
    </Kb.Box2>
  )
}

const noChannel: Array<{channelname: string}> = []
const getChannelSuggestions = (
  s: Constants.ConvoState,
  teamname: string,
  teamMeta: TeamsConstants.State['teamMeta']
) => {
  if (!teamname) {
    // this is an impteam, so get mutual teams from state
    const mutualTeams = s.mutualTeams.map(teamID => teamMeta.get(teamID)?.teamname)
    if (!mutualTeams?.length) {
      return noChannel
    }
    // TODO not reactive
    const suggestions = (C.useChatState.getState().inboxLayout?.bigTeams ?? []).reduce<
      Array<{channelname: string; teamname: string}>
    >((arr, t) => {
      t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel &&
        mutualTeams.includes(t.channel.teamname) &&
        arr.push({channelname: t.channel.channelname, teamname: t.channel.teamname})
      return arr
    }, [])

    return suggestions
  }
  // TODO: get all the channels in the team, too, for this
  // TODO not reactive
  const suggestions = (C.useChatState.getState().inboxLayout?.bigTeams ?? []).reduce<
    Array<{channelname: string}>
  >((arr, t) => {
    t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel &&
      t.channel.teamname === teamname &&
      arr.push({channelname: t.channel.channelname})
    return arr
  }, [])

  return suggestions
}

export const useDataSource = (conversationIDKey: Types.ConversationIDKey, filter: string) => {
  const [lastCID, setLastCID] = React.useState(conversationIDKey)

  const channelSuggestionsTriggered = C.useChatContext(s => s.dispatch.channelSuggestionsTriggered)
  if (lastCID !== conversationIDKey) {
    setLastCID(conversationIDKey)
    channelSuggestionsTriggered()
  }

  const meta = C.useChatContext(s => s.meta)
  const {teamID} = meta

  const suggestChannelsLoading = Container.useAnyWaiting([
    TeamsConstants.getChannelsWaitingKey(teamID),
    Constants.waitingKeyMutualTeams(conversationIDKey),
  ])
  const teamMeta = C.useTeamsState(s => s.teamMeta)
  return C.useChatContext(s => {
    const fil = filter.toLowerCase()
    // don't include 'small' here to ditch the single #general suggestion
    const teamname = meta.teamType === 'big' ? meta.teamname : ''
    const suggestChannels = getChannelSuggestions(s, teamname, teamMeta)

    // TODO this will thrash always
    return {
      items: suggestChannels.filter(ch => ch.channelname.toLowerCase().includes(fil)).sort(),
      loading: suggestChannelsLoading,
    }
  }, isEqual)
}
type ChannelType = {
  channelname: string
  teamname?: string
}
type ListProps = Pick<
  Common.ListProps<ChannelType>,
  'expanded' | 'suggestBotCommandsUpdateStatus' | 'listStyle' | 'spinnerStyle'
> & {
  conversationIDKey: Types.ConversationIDKey
  filter: string
  onSelected: (item: ChannelType, final: boolean) => void
  onMoveRef: React.MutableRefObject<((up: boolean) => void) | undefined>
  onSubmitRef: React.MutableRefObject<(() => boolean) | undefined>
}
export const List = (p: ListProps) => {
  const {filter, ...rest} = p
  const {items, loading} = useDataSource(p.conversationIDKey, filter)
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
