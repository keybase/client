// @flow
import * as Route from '../../../../actions/route-tree'
import {teamsTab} from '../../../../constants/tabs'
import SystemSimpleToComplex from '.'
import {connect, type TypedState} from '../../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  you: state.config.username || '',
})

const mapDispatchToProps = (dispatch) => ({
  _onManageChannels: (teamname: string) =>
    dispatch(Route.navigateAppend([{props: {teamname}, selected: 'manageChannels'}])),
  onViewTeam: (teamname: string) => {
    dispatch(Route.navigateTo([teamsTab, {props: {teamname}, selected: 'team'}]))
    dispatch(Route.setRouteState([teamsTab, 'team'], {selectedTab: 'members'}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  message: ownProps.message,
  onManageChannels: () => dispatchProps._onManageChannels(ownProps.message.team),
  onViewTeam: dispatchProps.onViewTeam,
  you: stateProps.you,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(SystemSimpleToComplex)
