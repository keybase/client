// @flow
import {compose, pausableConnect, withState, type TypedState} from '../../../../util/container'
import * as I from 'immutable'
import {BigTeamHeader} from '.'
// Typically you'd use the navigateAppend from the routeable component but this is a child* of that
// and I'd prefer not to plumb through anything that could cause render thrashing so using the
// global one here
import {navigateAppend, navigateTo} from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'

const mapStateToProps = (state: TypedState, {teamname, isActiveRoute}) => ({
  _teammembercounts: state.entities.getIn(['teams', 'teammembercounts'], I.Map()),
  isActiveRoute,
  teamname,
})

const mapDispatchToProps = dispatch => ({
  _onManageChannels: (teamname: string) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  _onShowMobileMenu: (teamname: string) => dispatch(navigateAppend([{props: {teamname}, selected: 'teamInfoMenu'}])),
  _onViewTeam: (teamname: string) => dispatch(navigateTo([teamsTab, {props: {teamname}, selected: 'team'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  isActiveRoute: stateProps.isActiveRoute,
  memberCount: stateProps._teammembercounts.get(stateProps.teamname),
  onManageChannels: () => dispatchProps._onManageChannels(stateProps.teamname),
  onSetShowMenu: ownProps.onSetShowMenu,
  onShowMobileMenu: dispatchProps._onShowMobileMenu(stateProps.teamname),
  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),
  showMenu: ownProps.showMenu,
  teamname: stateProps.teamname,
})

export default compose(
  withState('showMenu', 'onSetShowMenu', false),
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)
)(BigTeamHeader)
