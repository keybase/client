import * as React from 'react'
import * as Container from '../../util/container'
import WithContacts from './fetch-contacts.native'

type OwnProps = Container.RouteProps<{teamname: string}>
const TeamInviteByContact = (props: OwnProps) => {
  const teamname = Container.getRouteProps(props, 'teamname', '')
  return <WithContacts teamname={teamname} />
}

export default TeamInviteByContact
