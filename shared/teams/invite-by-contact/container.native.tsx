import * as React from 'react'
import * as Container from '../../util/container'
import WithContacts from './fetch-contacts.native'

type OwnProps = Container.RouteProps<{teamID: string}>
const TeamInviteByContact = (props: OwnProps) => {
  const teamID = Container.getRouteProps(props, 'teamID', '')
  return <WithContacts teamID={teamID} />
}

export default TeamInviteByContact
