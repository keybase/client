import * as I from 'immutable'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as WaitingGen from '../../../../actions/waiting-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {anyErrors} from '../../../../constants/waiting'
import AddToChannel from '.'

type OwnProps = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey}>

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const conversationIDKey = Container.getRouteProps(
    ownProps,
    'conversationIDKey',
    Constants.noConversationIDKey
  )
  const meta = Constants.getMeta(state, conversationIDKey)
  const teamname = meta.teamname
  const generalChannel = Constants.getChannelForTeam(state, teamname, 'general')
  const _fullnames = state.users.infoMap
  const title = `Add to #${meta.channelname}`
  return {
    _allMembers: generalChannel ? generalChannel.participants : I.List<string>(),
    _alreadyAdded: meta.participants,
    _conversationIDKey: conversationIDKey,
    _fullnames,
    error: anyErrors(state, Constants.waitingKeyAddUsersToChannel),
    title,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onSubmit: (conversationIDKey: Types.ConversationIDKey, usernames: Array<string>) =>
    dispatch(Chat2Gen.createAddUsersToChannel({conversationIDKey, usernames})),
  onCancel: () => {
    dispatch(WaitingGen.createClearWaiting({key: Constants.waitingKeyAddUsersToChannel}))
    dispatch(RouteTreeGen.createNavigateUp())
  },
})

export default Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, _: OwnProps) => {
    const users = stateProps._allMembers
      .map(username => ({
        alreadyAdded: stateProps._alreadyAdded.includes(username),
        fullname: stateProps._fullnames.get(username, {fullname: ''}).fullname,
        username,
      }))
      .sort((a, b) => {
        if (a.alreadyAdded === b.alreadyAdded) return a.username.localeCompare(b.username)
        return a.alreadyAdded ? 1 : -1
      })
      .toArray()
    let error: string | null = null
    if (stateProps.error) {
      const e = stateProps.error
      error = Container.isNetworkErr(e.code)
        ? 'There was a problem connecting to the internet, please try again.'
        : e.message
    }
    return {
      error,
      onBack: null,
      onCancel: dispatchProps.onCancel,
      onSubmit: (usernames: Array<string>) =>
        dispatchProps._onSubmit(stateProps._conversationIDKey, usernames),
      title: stateProps.title,
      users,
      waitingKey: Constants.waitingKeyAddUsersToChannel,
    }
  },
  'ConnectedChatAddToChannel'
)(AddToChannel)
