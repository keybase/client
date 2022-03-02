import * as React from 'react'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Waiting from '../../../../constants/waiting'
import * as Constants from '../../../../constants/chat2'
import * as TeamsConstants from '../../../../constants/teams'
import * as Common from './common'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import isEqual from 'lodash/isEqual'
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

export const keyExtractor = ({channelname, teamname}: {channelname: string; teamname?: string}) =>
  teamname ? `${teamname}#${channelname}` : channelname

export const Renderer = (p: any) => {
  const selected: boolean = p.selected
  const channelname: string = p.value.channelname
  const teamname: string | undefined = p.value.teamname
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
let _channelSuggestions: Array<{channelname: string; teamname?: string}> = noChannel
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

    if (!isEqual(_channelSuggestions, suggestions)) {
      _channelSuggestions = suggestions
    }
    return _channelSuggestions
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

  if (!isEqual(_channelSuggestions, suggestions)) {
    _channelSuggestions = suggestions
  }
  return _channelSuggestions
}

// TODO likely invert this relationship
export const useDataSource = (active: string, conversationIDKey: Types.ConversationIDKey, filter: string) => {
  const isActive = active === 'channel'
  return Container.useSelector(state => {
    if (!isActive) return null
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
      data: suggestChannels.filter(ch => ch.channelname.toLowerCase().includes(fil)).sort(),
      loading: suggestChannelsLoading,
      useSpaces: false,
    }
  })
}

export const List = (_p: any) => {
  return null
}
