import TeamInviteByContact from './team-invite-by-contacts'

type OwnProps = {teamID: string}

const ConnectedTeamInviteByContact = (props: OwnProps) => {
  return <TeamInviteByContact teamID={props.teamID} />
}

export default ConnectedTeamInviteByContact
