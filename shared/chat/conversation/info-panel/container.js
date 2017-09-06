// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import {SmallTeamInfoPanel, BigTeamInfoPanel} from '.'
import {Map} from 'immutable'
import {compose, renderComponent, branch} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {navigateAppend, navigateTo} from '../../../actions/route-tree'
import {chatTab} from '../../../constants/tabs'
import {showUserProfile} from '../../../actions/profile'

import type {TypedState} from '../../../constants/reducer'

import flags from '../../../util/feature-flags'

const getParticipants = createSelector(
  [Constants.getYou, Constants.getTLF, Constants.getFollowingMap, Constants.getMetaDataMap],
  (you, tlf, followingMap, metaDataMap) => {
    const users = tlf.split(',')

    return users.map(username => {
      const following = !!followingMap[username]
      const meta = metaDataMap.get(username, Map({}))
      const fullname = meta.get('fullname', 'Unknown')
      const broken = meta.get('brokenTracker', false)
      return {
        broken,
        following,
        fullname,
        meta,
        username,
      }
    })
  }
)

const mapStateToProps = (state: TypedState) => {
  const selectedConversationIDKey = Constants.getSelectedConversation(state)
  const inbox = Constants.getSelectedInbox(state)
  const channelname = inbox.get('channelname')
  const teamname = inbox.get('teamname')
  const showTeamButton = flags.teamChatEnabled

  return {
    channelname,
    muted: Constants.getMuted(state),
    participants: getParticipants(state),
    selectedConversationIDKey,
    showTeamButton,
    teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  _navToRootChat: () => dispatch(navigateTo([], [chatTab])),
  _onAddParticipant: (participants: Array<string>) => dispatch(Creators.newChat(participants)),
  _onLeaveConversation: (conversationIDKey: Constants.ConversationIDKey) => {
    dispatch(Creators.leaveConversation(conversationIDKey))
  },
  _onMuteConversation: (conversationIDKey: Constants.ConversationIDKey, muted: boolean) => {
    dispatch(Creators.muteConversation(conversationIDKey, muted))
  },
  _onShowBlockConversationDialog: (selectedConversation, participants) => {
    dispatch(
      navigateAppend([
        {
          props: {conversationIDKey: selectedConversation, participants},
          selected: 'showBlockConversationDialog',
        },
      ])
    )
  },
  _onShowNewTeamDialog: (conversationIDKey: Constants.ConversationIDKey) => {
    dispatch(
      navigateAppend([
        {
          props: {
            conversationIDKey: conversationIDKey,
          },
          selected: 'showNewTeamDialog',
        },
      ])
    )
  },
  // Used by HeaderHoc.
  onBack: () => dispatch(navigateUp()),
  onShowProfile: (username: string) => dispatch(showUserProfile(username)),
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
  onAddParticipant: () => dispatchProps._onAddParticipant(stateProps.participants.map(p => p.username)),
  onLeaveConversation: () => {
    if (stateProps.selectedConversationIDKey) {
      dispatchProps._onLeaveConversation(stateProps.selectedConversationIDKey)
      dispatchProps._navToRootChat()
    }
  },
  onMuteConversation: stateProps.selectedConversationIDKey &&
    !Constants.isPendingConversationIDKey(stateProps.selectedConversationIDKey)
    ? (muted: boolean) =>
        stateProps.selectedConversationIDKey &&
        dispatchProps._onMuteConversation(stateProps.selectedConversationIDKey, muted)
    : null,
  onShowBlockConversationDialog: () =>
    dispatchProps._onShowBlockConversationDialog(
      stateProps.selectedConversationIDKey,
      stateProps.participants.map(p => p.username).join(',')
    ),
  onShowNewTeamDialog: () => {
    stateProps.selectedConversationIDKey &&
      dispatchProps._onShowNewTeamDialog(stateProps.selectedConversationIDKey)
  },
})

const ConnectedInfoPanel = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => props.channelname, renderComponent(BigTeamInfoPanel))
)(SmallTeamInfoPanel)

export default ConnectedInfoPanel
