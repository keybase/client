import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import {BodyRow} from '.'
import MemberRow from './member-row/container'
import {RequestRow, InviteRow, InvitesEmptyRow, DividerRow} from './invite-row'

const renderRow = (row: BodyRow, teamID: Types.TeamID) => {
  switch (row.type) {
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
    case 'subteam-intro':
    case 'subteam-add':
    case 'subteam-none':
    case 'subteam-subteam':
      return null
    case 'settings':
      return null
  }
}

export default renderRow
