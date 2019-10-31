import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import {BodyRow} from '.'
import MemberRow from './member-row/container'

const renderRow = (row: BodyRow, teamID: Types.TeamID) => {
  switch (row.type) {
    case 'member':
      return <MemberRow teamID={teamID} username={row.username} />
    case 'invites-invite':
    case 'invites-request':
    case 'invites-divider':
    case 'invites-none':
      return null
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
