// @flow
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import type {RouteProps} from '../../../../route-tree/render-route'
import AddToChannel from '.'

type OwnProps = RouteProps<{conversationIDKey: Types.ConversationIDKey}, {}>

const mapStateToProps = (state, {routeProps}) => {
  const conversationIDKey = routeProps.get('conversationIDKey')
  const meta = Constants.getMeta(state, conversationIDKey)
  const teamname = meta.teamname
  const generalChannel = Constants.getChannelForTeam(state, teamname, 'general')
  const _fullnames = state.users.infoMap
  const title = `Add to #${meta.channelname}`
  return {
    _allMembers: generalChannel.participants,
    _alreadyAdded: meta.participants,
    _conversationIDKey: conversationIDKey,
    _fullnames,
    title,
  }
}

const mapDispatchToProps = dispatch => ({
  _onSubmit: (conversationIDKey, usernames) =>
    dispatch(Chat2Gen.createAddUsersToChannel({conversationIDKey, usernames})),
  onCancel: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const users = stateProps._allMembers
    .map(username => ({
      alreadyAdded: stateProps._alreadyAdded.includes(username),
      fullname: stateProps._fullnames.get(username, {fullname: ''}).fullname,
      username,
    }))
    .sort((a, b) => {
      if (a.alreadyAdded && b.alreadyAdded) return a.username.localeCompare(b.username)
      if (a.alreadyAdded) return 1
      if (b.alreadyAdded) return -1
      return a.username.localeCompare(b.username)
    })
    .toArray()
  return {
    onCancel: dispatchProps.onCancel,
    onSubmit: usernames => dispatchProps._onSubmit(stateProps._conversationIDKey, usernames),
    title: stateProps.title,
    users,
  }
}

export default Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedChatAddToChannel'
)(AddToChannel)
