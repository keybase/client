import Render from '.'
import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import * as Tracker2Constants from '../../constants/tracker2'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import {HeaderOrPopup} from '../../common-adapters'

type OwnProps = {}

export default Container.connect(
  (state: Container.TypedState) => ({
    _waiting: state.waiting,
    _you: state.config.username,
    teamDetails: state.teams.teamDetails,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onCancel: (you: string) => {
      // sadly a little racy, doing this for now
      setTimeout(() => {
        dispatch(
          Tracker2Gen.createLoad({
            assertion: you,
            guiID: Tracker2Constants.generateGUIID(),
            ignoreCache: true,
            inTracker: false,
            reason: '',
          })
        )
      }, 500)
      dispatch(RouteTreeGen.createNavigateUp())
    },
    onPromote: (teamname: string, showcase: boolean) =>
      dispatch(TeamsGen.createSetMemberPublicity({showcase, teamname})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    return {
      ...dispatchProps,
      customCancelText: 'Close',
      onCancel: () => dispatchProps.onCancel(stateProps._you),
      teams: Constants.sortTeamsByName(stateProps.teamDetails),
      title: 'Publish your teams',
      waiting: stateProps._waiting,
    }
  }
)(HeaderOrPopup(Render))
