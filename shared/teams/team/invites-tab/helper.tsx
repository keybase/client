import * as React from 'react'
import InviteDividerRow from './divider-row'
import InviteEmptyRow from './empty-row'
import InviteRow from './invite-row/container'
import RequestRow from './request-row/container'

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
