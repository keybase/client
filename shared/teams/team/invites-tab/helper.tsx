import * as React from 'react'
import {TypedState} from '../../../util/container'
import * as Types from '../../../constants/types/teams'
import * as I from 'immutable'
import * as Constants from '../../../constants/teams'
import InviteDividerRow from './divider-row'
import InviteEmptyRow from './empty-row'
import InviteRow from './invite-row/container'
import RequestRow from './request-row/container'

export type OwnProps = {
  teamname: string
}

type StateProps = {
  _invites: I.Set<Types.InviteInfo>
  _requests: I.Set<Types.RequestInfo>
}

/* Helpers to build the teams tabs. mapStateHelper is called by the master mapStateToProps, getRows makes the rows to be injected below the header, renderItem renders the individual row */
export const mapStateHelper = (state: TypedState, {teamname}: OwnProps): StateProps => ({
  _invites: Constants.getTeamInvites(state, teamname),
  _requests: Constants.getTeamRequests(state, teamname),
})

export const getRows = ({_requests, _invites}: StateProps) => {
  const requests = _requests.map(r => ({
    type: 'invites-request',
    username: r.username,
  }))
  const invites = _invites.map(i => ({id: i.id, type: 'invites-invite'}))
  return [
    ...(requests.size ? [{label: 'Requests', type: 'invites-divider'}] : []),
    ...requests,
    ...(invites.size ? [{label: 'Invites', type: 'invites-divider'}] : []),
    ...invites,
    ...(requests.size + invites.size === 0 ? [{type: 'invites-none'}] : []),
  ]
}

export const renderItem = (
  teamname: string,
  row: {
    id: string
    username: string
    label: string
    type: string
  }
) => {
  switch (row.type) {
    case 'invites-invite':
      return <InviteRow teamname={teamname} id={row.id} key={row.id} />
    case 'invites-request':
      return <RequestRow teamname={teamname} username={row.username} key={row.username} />
    case 'invites-divider':
      return <InviteDividerRow key={row.label} label={row.label} />
    case 'invites-none':
      return <InviteEmptyRow key="invite-empty" />
    default:
      return null
  }
}
