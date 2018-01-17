// @flow
import React from 'react'
import {MentionHud} from '.'
import {createSelector} from '../../util/container'
import {connect, type MapStateToProps} from 'react-redux'
import {getTeamName} from '../../constants/chat'
import {getTeamToChannel} from '../inbox/container'
import * as ChatTypes from '../../constants/types/chat'

type ConnectedMentionHudProps = {
  onPickChannel: (user: string) => void,
  onSelectChannel: (user: string) => void,
  selectUpCounter: number,
  selectDownCounter: number,
  pickSelectedChannelCounter: number,
  filter: string,
  style?: Object,
}

const channelSelector = createSelector(
  [getTeamName, getTeamToChannel],
  (
    teamname: any,
    teamsToChannels
  ): {
    [channelname: string]: ChatTypes.ConversationIDKey,
  } => (teamname ? teamsToChannels[teamname] : {})
)

const mapStateToProps: MapStateToProps<*, *, *> = (state, {filter}) => {
  return {
    channels: channelSelector(state),
    filter: filter.toLowerCase(),
  }
}

const ConnectedMentionHud: Class<React.Component<ConnectedMentionHudProps, void>> = connect(mapStateToProps)(
  MentionHud
)

export default ConnectedMentionHud
