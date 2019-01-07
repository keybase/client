// @flow
import * as Container from '../../../util/container'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Constants from '../../../constants/tracker2'
import Teams from '.'

type OwnProps = {|
  username: string,
|}

const mapStateToProps = (state, ownProps) => {
  const d = state.tracker2.usernameToDetails.get(ownProps.username, Constants.noDetails)
  return {
    _teamShowcase: d.teamShowcase,
  }
}
const mapDispatchToProps = (dispatch, ownProps) => ({
  onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onJoinTeam: dispatchProps.onJoinTeam,
  teamShowcase: stateProps._teamShowcase ? stateProps._teamShowcase.map(t => t.toObject()).toArray() : null,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Teams'
)(Teams)
