// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import InfoPanel from '.'
import {Map} from 'immutable'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {navigateAppend} from '../../../actions/route-tree'
import {onUserClick} from '../../../actions/profile'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  onToggleInfoPanel: () => void,
}

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

const mapStateToProps = (state: TypedState) => ({
  muted: Constants.getMuted(state),
  participants: getParticipants(state),
  selectedConversationIDKey: Constants.getSelectedConversation(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {onToggleInfoPanel}: OwnProps) => ({
  onAddParticipant: (participants: Array<string>) => dispatch(Creators.newChat(participants)),
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
  onShowProfile: (username: string) => dispatch(onUserClick(username)),
  onToggleInfoPanel,
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
  onAddParticipant: () =>
    dispatchProps.onAddParticipant(stateProps.participants.filter(p => !p.isYou).map(p => p.username)),
  onMuteConversation: (muted: boolean) =>
    stateProps.selectedConversationIDKey &&
    dispatchProps.onMuteConversation(stateProps.selectedConversationIDKey, muted),
  onShowBlockConversationDialog: () =>
    dispatchProps.onShowBlockConversationDialog(
      stateProps.selectedConversationIDKey,
      stateProps.participants.map(p => p.username).join(',')
    ),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps))(InfoPanel)
