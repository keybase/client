import Render from '.'
import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/teams'
import type * as TeamsTypes from '../../constants/types/teams'
import * as Tracker2Constants from '../../constants/tracker2'
import * as Tracker2Gen from '../../actions/tracker2-gen'

type OwnProps = {}

export default Container.connect(
  (state: Container.TypedState) => ({
    _waiting: state.waiting.counts,
    _you: state.config.username,
    teamMeta: state.teams.teamMeta,
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
    onPromote: (teamID: TeamsTypes.TeamID, showcase: boolean) =>
      dispatch(TeamsGen.createSetMemberPublicity({showcase, teamID})),
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    return {
      ...dispatchProps,
      onCancel: () => dispatchProps.onCancel(stateProps._you),
      teams: Constants.sortTeamsByName(stateProps.teamMeta),
      waiting: stateProps._waiting,
    }
  }
)(Render)
