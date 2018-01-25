// @flow
import * as RouteTree from '../../../../actions/route-tree'
import SystemAddedToTeam from '.'
import {teamsTab} from '../../../../constants/tabs'
import {connect, type TypedState, type Dispatch} from '../../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  you: state.config.username || '',
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onManageChannels: (teamname: string) =>
    dispatch(RouteTree.navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  _onViewTeam: (teamname: string) => {
    dispatch(RouteTree.setRouteState([teamsTab, 'team'], {selectedTab: 'members'}))
    dispatch(RouteTree.navigateTo([teamsTab, {props: {teamname}, selected: 'team'}]))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  message: ownProps.message,
  onManageChannels: () => dispatchProps._onManageChannels(ownProps.message.team),
  onViewTeam: () => dispatchProps._onViewTeam(ownProps.message.team),
  you: stateProps.you,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SystemAddedToTeam)
