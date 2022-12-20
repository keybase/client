import type * as Container from '../../util/container'
import TeamInviteByContact from './team-invite-by-contacts.native'

type OwnProps = Container.RouteProps<'teamInviteByContact'>
const ConnectedTeamInviteByContact = (props: OwnProps) => {
  const teamID = props.route.params?.teamID ?? ''
  return <TeamInviteByContact teamID={teamID} />
}

export default ConnectedTeamInviteByContact
