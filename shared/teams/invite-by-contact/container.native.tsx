import TeamInviteByContact from './team-invite-by-contacts.native'

type OwnProps = {teamID: string}
const ConnectedTeamInviteByContact = (props: OwnProps) => {
  const teamID = props.teamID
  return <TeamInviteByContact teamID={teamID} />
}

export default ConnectedTeamInviteByContact
