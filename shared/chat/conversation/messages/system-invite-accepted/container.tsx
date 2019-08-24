import SystemInviteAccepted from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import {teamsTab} from '../../../../constants/tabs'
import {connect} from '../../../../util/container'

type OwnProps = {
  message: Types.MessageSystemInviteAccepted
}

const mapStateToProps = (state, ownProps) => ({
  teamname: Constants.getMeta(state, ownProps.message.conversationIDKey).teamname,
  you: state.config.username,
})

const mapDispatchToProps = dispatch => ({
  _onViewTeam: (teamname: string) => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab, {props: {teamname}, selected: 'team'}]}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  message: ownProps.message,
  onViewTeam: () => dispatchProps._onViewTeam(stateProps.teamname),
  teamname: stateProps.teamname,
  you: stateProps.you,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(SystemInviteAccepted)
