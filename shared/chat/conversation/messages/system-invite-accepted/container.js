// @flow
import SystemInviteAccepted from '.'
import * as Route from '../../../../actions/route-tree'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import {teamsTab} from '../../../../constants/tabs'
import {connect} from '../../../../util/container'

type OwnProps = {|
  message: Types.MessageSystemInviteAccepted,
|}

const mapStateToProps = (state, ownProps) => ({
  teamname: Constants.getMeta(state, ownProps.message.conversationIDKey).teamname,
  you: state.config.username,
})

const mapDispatchToProps = dispatch => ({
  _onViewTeam: (teamname: string) => {
    dispatch(Route.navigateTo([teamsTab, {props: {teamname}, selected: 'team'}]))
    dispatch(Route.setRouteState([teamsTab, 'team'], {selectedTab: 'members'}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  message: ownProps.message,
  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),
  teamname: stateProps.teamname,
  you: stateProps.you,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(SystemInviteAccepted)
