import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as TeamTypes from '../../../../constants/types/teams'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as WaitingGen from '../../../../actions/waiting-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as TeamsGen from '../../../../actions/teams-gen'
import {anyErrors} from '../../../../constants/waiting'
import AddToChannel from '.'

type OwnProps = Container.RouteProps<{conversationIDKey: Types.ConversationIDKey}>

export default Container.namedConnect(
  (state, ownProps: OwnProps) => {
    const conversationIDKey = Container.getRouteProps(
      ownProps,
      'conversationIDKey',
      Constants.noConversationIDKey
    )
    const meta = Constants.getMeta(state, conversationIDKey)
    const participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    const _fullnames = state.users.infoMap
    const title = `Add to #${meta.channelname}`
    const _allMembers = state.teams.teamIDToMembers.get(meta.teamID)
    return {
      _allMembers,
      _alreadyAdded: participantInfo.all,
      _conversationIDKey: conversationIDKey,
      _fullnames,
      _teamID: meta.teamID,
      error: anyErrors(state, Constants.waitingKeyAddUsersToChannel),
      title,
    }
  },
  dispatch => ({
    _onLoad: (teamID: TeamTypes.TeamID) => {
      dispatch(TeamsGen.createGetMembers({teamID}))
    },
    _onSubmit: (conversationIDKey: Types.ConversationIDKey, usernames: Array<string>) =>
      dispatch(Chat2Gen.createAddUsersToChannel({conversationIDKey, usernames})),
    onCancel: () => {
      dispatch(WaitingGen.createClearWaiting({key: Constants.waitingKeyAddUsersToChannel}))
      dispatch(RouteTreeGen.createNavigateUp())
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const users = !stateProps._allMembers
      ? []
      : [...stateProps._allMembers.values()]
          .filter(member => {
            return member.type !== 'restrictedbot' && member.type !== 'bot'
          })
          .map(member => ({
            alreadyAdded: stateProps._alreadyAdded.includes(member.username),
            fullname: (stateProps._fullnames.get(member.username) || {fullname: ''}).fullname || '',
            username: member.username,
          }))
          .sort((a, b) => {
            if (a.alreadyAdded === b.alreadyAdded) return a.username.localeCompare(b.username)
            return a.alreadyAdded ? 1 : -1
          })
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
      onLoad: () => dispatchProps._onLoad(stateProps._teamID),
      onSubmit: (usernames: Array<string>) =>
        dispatchProps._onSubmit(stateProps._conversationIDKey, usernames),
      title: stateProps.title,
      users,
      waitingKey: Constants.waitingKeyAddUsersToChannel,
    }
  },
  'ConnectedChatAddToChannel'
)(AddToChannel)
