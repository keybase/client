import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'

type Props = {
  teamID: Types.TeamID
  username: string
}

class TeamMember extends React.Component<Container.RouteProps<Props>> {
  static navigationOptions = (ownProps: Container.RouteProps<Props>) => ({
    headerTitle: () => (
      <TeamMemberHeader
        teamID={Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)}
        username={Container.getRouteProps(ownProps, 'username', '')}
      />
    ),
  })
  render() {
    return null
  }
}

const TeamMemberHeader = (props: Props) => {
  const {teamID, username} = props
  const dispatch = Container.useDispatch()

  const teamMeta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = Container.useSelector(s => Constants.getTeamDetails(s, teamID))

  const member = teamDetails.members.get(username)
  if (!member) {
    // loading? should never happen.
    return null
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
        <Kb.Box2 direction="horizontal" alignItems="center" gap="xtiny" alignSelf="flex-start">
          <Kb.Avatar size={16} teamname={teamMeta.teamname} />
          <Kb.Text type="BodySmallSemiboldSecondaryLink" onClick={() => {} /* TODO */}>
            {teamMeta.teamname}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

export default TeamMember
