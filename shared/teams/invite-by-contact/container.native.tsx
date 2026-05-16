import TeamInviteByContact from '@/teams/invite-by-contact/team-invite-by-contacts.native'

type OwnProps = {teamID: string}
const ConnectedTeamInviteByContact = (props: OwnProps) => {
  const teamID = props.teamID
  return <TeamInviteByContact teamID={teamID} />
}

export default ConnectedTeamInviteByContact
