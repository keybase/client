// @flow
import * as I from 'immutable'
import Render from './index'
import {compose, connect, lifecycle, type RouteProps} from '../../util/container'
import * as TeamsGen from '../../actions/teams-gen'
import * as Constants from '../../constants/tracker2'
import * as Tracker2Gen from '../../actions/tracker2-gen'
import {HeaderOrPopup} from '../../common-adapters'
import {getSortedTeamnames} from '../../constants/teams'
import flags from '../../util/feature-flags'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => {
  return {
    _teamNameToAllowPromote: state.teams.getIn(['teamNameToAllowPromote'], I.Map()),
    _teamNameToCanPerform: state.teams.getIn(['teamNameToCanPerform'], I.Map()),
    _teamNameToIsOpen: state.teams.getIn(['teamNameToIsOpen'], I.Map()),
    _teamNameToIsShowcasing: state.teams.getIn(['teamNameToIsShowcasing'], I.Map()),
    _teamNameToPublicitySettings: state.teams.getIn(['teamNameToPublicitySettings'], I.Map()),
    _teamNameToRole: state.teams.getIn(['teamNameToRole'], I.Map()),
    _teammembercounts: state.teams.getIn(['teammembercounts'], I.Map()),
    _waiting: state.waiting,
    _you: state.config.username,
    teamnames: getSortedTeamnames(state),
  }
}

const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  loadTeams: teamname => dispatch(TeamsGen.createGetTeams()),
  onCancel: (you: string) => {
    if (flags.identify3) {
      // sadly a little racy, doing this for now
      setTimeout(() => {
        dispatch(
          Tracker2Gen.createLoad({
            assertion: you,
            guiID: Constants.generateGUIID(),
            ignoreCache: true,
            inTracker: false,
            reason: 'teams maybe changed',
          })
        )
      }, 500)
    }
    dispatch(navigateUp())
  },
  onPromote: (teamname, showcase) => dispatch(TeamsGen.createSetMemberPublicity({showcase, teamname})),
})

const mergeProps = (stateProps, dispatchProps) => {
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
    waiting: stateProps._waiting.toObject(),
  }
}

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  lifecycle({
    componentDidMount() {
      this.props.loadTeams()
    },
  })
)(HeaderOrPopup(Render))
