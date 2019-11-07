import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import {Row} from '.'
import MemberRow from './member-row/container'
import {RequestRow, InviteRow, InvitesEmptyRow, DividerRow} from './invite-row'
import {SubteamAddRow, SubteamIntroRow, SubteamNoneRow, SubteamTeamRow} from './subteam-row'
import LoadingRow from './loading'
import TeamHeaderRow from '../header/container'

const renderRow = (row: Row, teamID: Types.TeamID) => {
  switch (row.type) {
    case 'header':
      return <TeamHeaderRow teamID={teamID} />
    case 'member':
      return <MemberRow teamID={teamID} username={row.username} />
    case 'invites-invite':
      return <InviteRow teamID={teamID} id={row.id} />
    case 'invites-request':
      return <RequestRow teamID={teamID} username={row.username} />
    case 'invites-divider':
      return <DividerRow label={row.label} />
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
    case 'loading':
      return <LoadingRow />
    case 'settings':
    case 'tabs':
      // Handled in team/index for now
      return null
  }
}

export default renderRow
