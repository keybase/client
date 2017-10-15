// @flow
import {pausableConnect, type TypedState} from '../../../../util/container'
import {BigTeamHeader} from '.'

const mapStateToProps = (state: TypedState, {teamname}) => {
  return {teamname}
}

const mapDispatchToProps = (dispatch, {navigateAppend}) => ({
  _onShowMenu: (teamname: string) =>
    dispatch(navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  onShowMenu: () => dispatchProps._onShowMenu(stateProps.teamname),
  teamname: stateProps.teamname,
})

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(BigTeamHeader)
