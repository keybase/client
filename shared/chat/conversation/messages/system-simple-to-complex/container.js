// @flow
import * as Types from '../../../../constants/types/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {teamsTab} from '../../../../constants/tabs'
import SystemSimpleToComplex from '.'
import {connect} from '../../../../util/container'

type OwnProps = {|
  message: Types.MessageSystemSimpleToComplex,
|}

const mapStateToProps = state => ({
  you: state.config.username || '',
})

const mapDispatchToProps = dispatch => ({
  _onManageChannels: (teamname: string) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'manageChannels'}]})),
  onViewTeam: (teamname: string) => {
    dispatch(RouteTreeGen.createNavigateTo({path: [teamsTab, {props: {teamname}, selected: 'team'}]}))
    dispatch(
      RouteTreeGen.createSetRouteState({partialState: {selectedTab: 'members'}, path: [teamsTab, 'team']})
    )
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  message: ownProps.message,
  onManageChannels: () => dispatchProps._onManageChannels(ownProps.message.team),
  onViewTeam: dispatchProps.onViewTeam,
  you: stateProps.you,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(SystemSimpleToComplex)
