// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import {InfoPanel, ChannelInfoPanel} from '.'
import {Map} from 'immutable'
import {compose, renderComponent, branch} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {navigateAppend} from '../../../actions/route-tree'
import {showUserProfile} from '../../../actions/profile'

import type {TypedState} from '../../../constants/reducer'

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
  return {
    channelname,
    muted: Constants.getMuted(state),
    participants: getParticipants(state),
    selectedConversationIDKey,
    teamname,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onAddParticipant: (participants: Array<string>) => dispatch(Creators.newChat(participants)),
  onBack: () => dispatch(navigateUp()),
  onMuteConversation: (conversationIDKey: Constants.ConversationIDKey, muted: boolean) => {
    dispatch(Creators.muteConversation(conversationIDKey, muted))
  },
  onShowBlockConversationDialog: (selectedConversation, participants) => {
    dispatch(
      navigateAppend([
        {
          props: {conversationIDKey: selectedConversation, participants},
          selected: 'showBlockConversationDialog',
        },
      ])
    )
  },
  onShowProfile: (username: string) => dispatch(showUserProfile(username)),
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
  onAddParticipant: () => dispatchProps.onAddParticipant(stateProps.participants.map(p => p.username)),
  onMuteConversation: stateProps.selectedConversationIDKey &&
    !Constants.isPendingConversationIDKey(stateProps.selectedConversationIDKey)
    ? (muted: boolean) =>
        stateProps.selectedConversationIDKey &&
        dispatchProps.onMuteConversation(stateProps.selectedConversationIDKey, muted)
    : null,
  onShowBlockConversationDialog: () =>
    dispatchProps.onShowBlockConversationDialog(
      stateProps.selectedConversationIDKey,
      stateProps.participants.map(p => p.username).join(',')
    ),
})

const ConnectedInfoPanel = compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  branch(props => props.channelname, renderComponent(ChannelInfoPanel))
)(InfoPanel)

export default ConnectedInfoPanel
