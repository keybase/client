import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'

type Props = Container.RouteProps<{
  teamID: Types.TeamID
  username: string
}>

const TeamMember = (props: Props) => {
  const dispatch = Container.useDispatch()

  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  const username = Container.getRouteProps(props, 'username', '')
  const teamMeta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = Container.useSelector(s => Constants.getTeamDetails(s, teamID))

  const member = teamDetails.members.get(username)
  if (!member) {
    // loading? should never happen.
    return null
  }
}

export default TeamMember
