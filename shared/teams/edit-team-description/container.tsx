import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import EditTeamDescription from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'

type OwnProps = Container.RouteProps<{teamname: string}>

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const teamname = Container.getRouteProps(ownProps, 'teamname', '')
    if (!teamname) {
      throw new Error('There was a problem loading the description page, please report this error.')
    }
    const origDescription = Constants.getTeamPublicitySettings(state, teamname).description
    return {
      origDescription,
      teamname,
    }
  },
  dispatch => ({
    _onSubmit: (description: string, teamname: string) => {
      dispatch(TeamsGen.createEditTeamDescription({description, teamname}))
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onClose: () => dispatch(RouteTreeGen.createNavigateUp()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    ...stateProps,
    onClose: dispatchProps.onClose,
    onSubmit: (description: string) => dispatchProps._onSubmit(description, stateProps.teamname),
    waitingKey: Constants.teamWaitingKey(stateProps.teamname),
  })
)(EditTeamDescription)
