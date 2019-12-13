import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import EditTeamDescription from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'

type OwnProps = Container.RouteProps<{teamID: Types.TeamID}>

const mapStateToProps = (state, ownProps) => {
  const teamID = Container.getRouteProps(ownProps, 'teamID', Types.noTeamID)
  if (!teamID || teamID === Types.noTeamID) {
    throw new Error('There was a problem loading the description page, please report this error.')
  }
  const origDescription = Constants.getTeamDetails(state, teamID).description
  const {teamname} = Constants.getTeamMeta(state, teamID)
  return {
    origDescription,
    teamname,
    waitingKey: Constants.teamWaitingKey(teamname),
  }
}

const mapDispatchToProps = dispatch => ({
  _onSetDescription: (description: string, teamname) => {
    dispatch(
      TeamsGen.createEditTeamDescription({
        description,
        teamname,
      })
    )
    dispatch(RouteTreeGen.createNavigateUp())
  },
  onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  ...stateProps,
  ...dispatchProps,
})

const ConnectedEditTeamDescription = Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, mergeProps),
  Container.withStateHandlers(({origDescription}: any) => ({description: origDescription}), {
    onChangeDescription: () => description => ({description}),
  }),
  Container.withHandlers({
    onSetDescription: ({description, teamname, _onSetDescription}) => () =>
      _onSetDescription(description, teamname),
  } as any)
)(EditTeamDescription as any)

export default ConnectedEditTeamDescription
