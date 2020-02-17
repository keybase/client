import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as ChatTypes from '../../../constants/types/chat2'
import LoadingRow from '../../team/rows/loading'
import {Row} from '.'
import {BotRow, AddBotRow} from './bot-row'
import {RequestRow, InviteRow, InvitesEmptyRow, DividerRow} from './invite-row'
import {SubteamAddRow, SubteamIntroRow, SubteamNoneRow, SubteamTeamRow, SubteamInfoRow} from './subteam-row'
import {ChannelRow, ChannelHeaderRow, ChannelFooterRow} from './channel-row'
import ChannelHeaderRow from '../header/container'
import SettingsRow from '../settings-tab/container'

const renderRow = (row: Row, teamID: Types.TeamID, conversationIDKey: ChatTypes.ConversationIDKey) => {
  switch (row.type) {
    case 'header':
      return <ChannelHeaderRow teamID={teamID} conversationIDKey={conversationIDKey} />
    case 'loading':
      return <LoadingRow />
    case 'tabs':
      // Handled in team/index for now
      return null
  }
}

export default renderRow
