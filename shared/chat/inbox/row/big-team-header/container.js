// @flow
import {compose, connect, withStateHandlers, type TypedState} from '../../../../util/container'
import * as I from 'immutable'
import {BigTeamHeader} from '.'
// Typically you'd use the navigateAppend from the routeable component but this is a child* of that
// and I'd prefer not to plumb through anything that could cause render thrashing so using the
// global one here
import {navigateAppend, navigateTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'

const mapStateToProps = (state: TypedState, {teamname}) => ({
  _teammembercounts: state.entities.getIn(['teams', 'teammembercounts'], I.Map()),
  teamname,
})

const mapDispatchToProps = dispatch => ({
  _onManageChannels: (teamname: string) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  _onViewTeam: (teamname: string) => dispatch(navigateTo([teamsTab, {props: {teamname}, selected: 'team'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  memberCount: stateProps._teammembercounts.get(stateProps.teamname, 0),
  onManageChannels: () => dispatchProps._onManageChannels(stateProps.teamname),
  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),
  teamname: stateProps.teamname,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers({showMenu: false}, {onSetShowMenu: () => showMenu => ({showMenu})})
)(BigTeamHeader)
