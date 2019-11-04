import * as I from 'immutable'
import Render from './index'
import * as Container from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Constants from '../../constants/tracker2'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import {HeaderOrPopup} from '../../common-adapters'
import {getSortedTeamnames} from '../../constants/teams'

type OwnProps = {}

const mapStateToProps = (state: Container.TypedState) => {
  return {
    _teamNameToAllowPromote: state.teams.teamNameToAllowPromote || I.Map(),
    _teamNameToIsOpen: state.teams.teamNameToIsOpen || I.Map(),
    _teamNameToIsShowcasing: state.teams.teamNameToIsShowcasing || I.Map(),
    _teamNameToPublicitySettings: state.teams.teamNameToPublicitySettings || I.Map(),
    _teamNameToRole: state.teams.teamNameToRole || I.Map(),
    _teammembercounts: state.teams.teammembercounts || I.Map(),
    _waiting: state.waiting,
    _you: state.config.username,
    teamnames: getSortedTeamnames(state),
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  loadTeams: () => dispatch(TeamsGen.createGetTeams()),
  onCancel: (you: string) => {
    // sadly a little racy, doing this for now
    setTimeout(() => {
      dispatch(
        Tracker2Gen.createLoad({
          assertion: you,
          guiID: Constants.generateGUIID(),
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
})

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, _: OwnProps) => {
    return {
      ...stateProps,
      ...dispatchProps,
      customCancelText: 'Close',
      onCancel: () => dispatchProps.onCancel(stateProps._you),
      teamNameToAllowPromote: stateProps._teamNameToAllowPromote.toObject(),
      teamNameToIsOpen: stateProps._teamNameToIsOpen.toObject(),
      teamNameToIsShowcasing: stateProps._teamNameToIsShowcasing.toObject(),
      teamNameToRole: stateProps._teamNameToRole.toObject(),
      teammembercounts: stateProps._teammembercounts.toObject(),
      title: 'Publish your teams',
      waiting: stateProps._waiting,
    }
  }),
  Container.lifecycle({
    componentDidMount() {
      this.props.loadTeams()
    },
  } as any)
)(HeaderOrPopup(Render))
