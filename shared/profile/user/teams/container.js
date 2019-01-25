// @flow
import * as Container from '../../../util/container'
import * as TeamsGen from '../../../actions/teams-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/tracker2'
import Teams from '.'

type OwnProps = {|
  username: string,
|}

const noTeams = []

const mapStateToProps = (state, ownProps) => {
  const d = Constants.getDetails(state, ownProps.username)
  return {
    _isYou: state.config.username === ownProps.username,
    _roles: state.teams.teamNameToRole,
    _teamShowcase: d.teamShowcase,
  }
}
const mapDispatchToProps = (dispatch, ownProps) => ({
  onEdit: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['showcaseTeamOffer']})),
  onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onEdit: stateProps._isYou ? dispatchProps.onEdit : null,
  onJoinTeam: dispatchProps.onJoinTeam,
  teamMeta: (stateProps._teamShowcase || []).reduce((map, t) => {
    map[t.name] = {
      inTeam: stateProps._roles.get(t.name) || false,
    }
    return map
  }, {}),
  teamShowcase: stateProps._teamShowcase
    ? stateProps._teamShowcase.map(t => t.toObject()).toArray()
    : noTeams,
})

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Teams'
)(Teams)
