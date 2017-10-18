// @flow
import {pausableConnect, type TypedState} from '../../../../util/container'
import {BigTeamHeader} from '.'
// Typically you'd use the navigateAppend from the routeable component but this is a child* of that
// and I'd prefer not to plumb through anything that could cause render thrashing so using the
// global one here
import {navigateAppend} from '../../../../actions/route-tree'

const mapStateToProps = (state: TypedState, {teamname, isActiveRoute}) => {
  return {isActiveRoute, teamname}
}

const mapDispatchToProps = dispatch => ({
  _onShowMenu: (teamname: string) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  isActiveRoute: stateProps.isActiveRoute,
  onShowMenu: () => dispatchProps._onShowMenu(stateProps.teamname),
  teamname: stateProps.teamname,
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(BigTeamHeader)
