// @flow
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {TeamRequestRow} from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {createShowUserProfile} from '../../../../actions/profile-gen'
import {connect} from '../../../../util/container'

type OwnProps = {
  username: string,
  teamname: string,
}

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  _onAccept: (name: string, username: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [
        {
          props: {teamname: name, username},
          selected: 'rolePicker',
        },
      ]})
    ),
  _onChat: username => {
    username && dispatch(Chat2Gen.createPreviewConversation({participants: [username], reason: 'teamInvite'}))
  },
  _onIgnoreRequest: (teamname: string, username: string) =>
    dispatch(TeamsGen.createIgnoreRequest({teamname, username})),
  onOpenProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  return {
    onAccept: () => dispatchProps._onAccept(ownProps.teamname, ownProps.username),
    onChat: () => dispatchProps._onChat(ownProps.username),
    onIgnoreRequest: () => dispatchProps._onIgnoreRequest(ownProps.teamname, ownProps.username),
    onOpenProfile: dispatchProps.onOpenProfile,
    teamname: ownProps.teamname,
    username: ownProps.username,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(TeamRequestRow)
