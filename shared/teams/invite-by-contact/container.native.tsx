import * as React from 'react'
import * as Container from '../../util/container'
import TeamInviteByContact from './team-invite-by-contacts.native'

type OwnProps = Container.RouteProps<{teamID: string}>
const ConnectedTeamInviteByContact = (props: OwnProps) => {
  const teamID = Container.getRouteProps(props, 'teamID', '')
  return <TeamInviteByContact teamID={teamID} />
}

export default ConnectedTeamInviteByContact
