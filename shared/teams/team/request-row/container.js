// @flow
import * as TeamsGen from '../../../actions/teams-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {TeamRequestRow} from '.'
import {navigateAppend} from '../../../actions/route-tree'
import {createShowUserProfile} from '../../../actions/profile-gen'
import {connect, type TypedState} from '../../../util/container'

type OwnProps = {
  username: string,
  teamname: string,
}

const mapStateToProps = (state: TypedState) => ({})

type DispatchProps = {
  onOpenProfile: (u: string) => void,
  _onAccept: (string, string) => void,
  _onChat: (string, ?string) => void,
  _onIgnoreRequest: (name: string, username: string) => void,
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  _onAccept: (name: string, username: string) =>
    dispatch(
      navigateAppend([
        {
          props: {teamname: name, username},
          selected: 'rolePicker',
        },
      ])
    ),
  _onChat: username => {
    username && dispatch(Chat2Gen.createStartConversation({participants: [username]}))
  },
  _onIgnoreRequest: (teamname: string, username: string) =>
    dispatch(TeamsGen.createIgnoreRequest({teamname, username})),
  onOpenProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps: DispatchProps, ownProps: OwnProps) => {
  return {
    ...ownProps,
    ...dispatchProps,
    ...stateProps,
    onAccept: () => dispatchProps._onAccept(ownProps.teamname, ownProps.username),
    onChat: () => dispatchProps._onChat(ownProps.username),
    onIgnoreRequest: () => dispatchProps._onIgnoreRequest(ownProps.teamname, ownProps.username),
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(TeamRequestRow)
