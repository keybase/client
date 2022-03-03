import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Waiting from '../../../../constants/waiting'
import * as Constants from '../../../../constants/chat2'
import * as TeamsConstants from '../../../../constants/teams'
import * as Common from './common'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
// import isEqual from 'lodash/isEqual'
import * as Container from '../../../../util/container'
import type * as TeamsTypes from '../../../../constants/types/teams'
import type * as Types from '../../../../constants/types/chat2'

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

const ItemRenderer = (p: {selected: boolean; item: ChannelType}) => {
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
  state: Container.TypedState,
  teamname: string,
  _: TeamsTypes.TeamID,
  convID?: Types.ConversationIDKey
) => {
  if (!teamname) {
    // this is an impteam, so get mutual teams from state
    if (!convID) {
      return noChannel
    }
    const mutualTeams = (state.chat2.mutualTeamMap.get(convID) ?? []).map(teamID =>
      TeamsConstants.getTeamNameFromID(state, teamID)
    )
    if (!mutualTeams) {
      return noChannel
    }
    // TODO: maybe we shouldn't rely on this inboxlayout being around?
    const suggestions = (state.chat2.inboxLayout?.bigTeams ?? []).reduce<
      Array<{channelname: string; teamname: string}>
    >((arr, t) => {
      if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
        if (mutualTeams.includes(t.channel.teamname)) {
          arr.push({channelname: t.channel.channelname, teamname: t.channel.teamname})
        }
      }
      return arr
    }, [])

    return suggestions
  }
  // TODO: get all the channels in the team, too, for this
  const suggestions = (state.chat2.inboxLayout?.bigTeams ?? []).reduce<Array<{channelname: string}>>(
    (arr, t) => {
      if (t.state === RPCChatTypes.UIInboxBigTeamRowTyp.channel) {
        if (t.channel.teamname === teamname) {
          arr.push({channelname: t.channel.channelname})
        }
      }
      return arr
    },
    []
  )

  return suggestions
}

export const useDataSource = (conversationIDKey: Types.ConversationIDKey, filter: string) => {
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    dispatch(Chat2Gen.createChannelSuggestionsTriggered({conversationIDKey}))
  }, [dispatch, conversationIDKey])

  return Container.useSelector(state => {
    const fil = filter.toLowerCase()
    const meta = Constants.getMeta(state, conversationIDKey)
    // don't include 'small' here to ditch the single #general suggestion
    const teamname = meta.teamType === 'big' ? meta.teamname : ''
    const suggestChannels = getChannelSuggestions(state, teamname, meta.teamID, conversationIDKey)

    const suggestChannelsLoading = Waiting.anyWaiting(
      state,
      TeamsConstants.getChannelsWaitingKey(meta.teamID),
      Constants.waitingKeyMutualTeams(conversationIDKey)
    )

    return {
      items: suggestChannels.filter(ch => ch.channelname.toLowerCase().includes(fil)).sort(),
      loading: suggestChannelsLoading,
    }
  })
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
  onSubmitRef: React.MutableRefObject<(() => void) | undefined>
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
