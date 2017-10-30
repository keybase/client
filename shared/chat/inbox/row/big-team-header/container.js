// @flow
import {compose, pausableConnect, withState, type TypedState} from '../../../../util/container'
import {BigTeamHeader} from '.'
// Typically you'd use the navigateAppend from the routeable component but this is a child* of that
// and I'd prefer not to plumb through anything that could cause render thrashing so using the
// global one here
import {navigateAppend} from '../../../../actions/route-tree'

const mapStateToProps = (state: TypedState, {teamname, isActiveRoute}) => {
  return {isActiveRoute, teamname}
}

const mapDispatchToProps = dispatch => ({
  _onManageChannels: (teamname: string) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  console.warn('ownProps are', ownProps)
  return ({
  isActiveRoute: stateProps.isActiveRoute,
  onManageChannels: () => dispatchProps._onShowMenu(stateProps.teamname),
  onShowMenu: () => ownProps.setShowMenu(true),
  setShowMenu: ownProps.setShowMenu,
  showMenu: ownProps.showMenu,
  teamname: stateProps.teamname,
  })
}

export default compose(
  withState('showMenu', 'setShowMenu', false),
  pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)
)(BigTeamHeader)
