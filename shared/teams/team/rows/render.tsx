import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import {Row} from '.'
import MemberRow from './member-row/container'
import {BotRow, AddBotRow} from './bot-row'
import {RequestRow, InviteRow, InvitesEmptyRow, DividerRow} from './invite-row'
import {SubteamAddRow, SubteamIntroRow, SubteamNoneRow, SubteamTeamRow, SubteamInfoRow} from './subteam-row'
import {ChannelRow, ChannelHeaderRow, ChannelFooterRow} from './channel-row'
import TeamPageDivider from './divider'
import LoadingRow from './loading'
import TeamHeaderRow from '../header/container'
import NewTeamHeaderRow from '../new-header'
import SettingsRow from '../settings-tab/container'
import flags from '../../../util/feature-flags'

const renderRow = (row: Row, teamID: Types.TeamID) => {
  switch (row.type) {
    case 'header':
      return flags.teamsRedesign ? <NewTeamHeaderRow teamID={teamID} /> : <TeamHeaderRow teamID={teamID} />
    case 'member':
      return <MemberRow teamID={teamID} username={row.username} />
    case 'bot':
      return <BotRow teamID={teamID} username={row.username} />
    case 'bot-add':
      return <AddBotRow teamID={teamID} />
    case 'channel-header':
      return <ChannelHeaderRow teamID={teamID} />
    case 'channel-footer':
      return <ChannelFooterRow />
    case 'channel':
      return <ChannelRow teamID={teamID} channel={row.channel} conversationIDKey={row.conversationIDKey} />
    case 'invites-divider':
      return <DividerRow label={row.label} />
    case 'invites-invite':
      return <InviteRow teamID={teamID} id={row.id} />
    case 'invites-request':
      return <RequestRow ctime={row.ctime} fullName={row.fullName} teamID={teamID} username={row.username} />
    case 'divider':
      return <TeamPageDivider teamID={teamID} count={row.count} type={row.dividerType} />
    case 'invites-none':
      return <InvitesEmptyRow />
    case 'subteam-add':
      return <SubteamAddRow teamID={teamID} />
    case 'subteam-intro':
      return <SubteamIntroRow teamID={teamID} />
    case 'subteam-none':
      return <SubteamNoneRow />
    case 'subteam-subteam':
      return <SubteamTeamRow teamID={row.teamID} />
    case 'subteam-info':
      return <SubteamInfoRow />
    case 'settings':
      return <SettingsRow teamID={teamID} />
    case 'loading':
      return <LoadingRow />
    case 'tabs':
      // Handled in team/index for now
      return null
  }
}

export default renderRow
