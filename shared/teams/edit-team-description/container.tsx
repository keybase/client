import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import EditTeamDescription from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID}>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const teamID = Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)
    const teamname = Constants.getTeamNameFromID(state, teamID)
    if (teamID === Types.noTeamID || teamname === null) {
      throw new Error(
        `There was a problem loading the description page, please report this error (teamID: ${teamID}, teamname: ${teamname}).`
      )
    }
    return {
      origDescription: Constants.getTeamPublicitySettings(state, teamID).description,
      teamID,
      teamname,
      waitingKey: Constants.teamWaitingKeyByID(teamID, state),
    }
  },
  dispatch => ({
    _onSubmit: (description: string, teamID: string) => {
      dispatch(TeamsGen.createEditTeamDescription({description, teamID}))
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    onClose: dispatchProps.onClose,
    onSubmit: (description: string) => dispatchProps._onSubmit(description, stateProps.teamID),
    waitingKey: stateProps.waitingKey,
  })
)(EditTeamDescription)
