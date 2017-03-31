// @flow
import * as Constants from '../../../constants/chat'
import * as Creators from '../../../actions/chat/creators'
import Header from '.'
import {List} from 'immutable'
import {compose} from 'recompose'
import {connect} from 'react-redux'
import {createSelector} from 'reselect'
import {onUserClick} from '../../../actions/profile'

import type {TypedState} from '../../../constants/reducer'

type OwnProps = {
  onBack: () => void,
  onToggleSidePanel: () => void,
  selectedConversation: ?Constants.ConversationIDKey,
  sidePanelOpen: boolean,
}

const getYou = (state: TypedState) => state.config.username || ''
const getFollowingMap = (state: TypedState) => state.config.following
const getMetaDataMap = (state: TypedState) => state.chat.get('metaData')
const getSelectedConversation = (_, selectedConversation: ?Constants.ConversationIDKey) => selectedConversation
const getSelectedInbox = (state: TypedState, selectedConversation: ?Constants.ConversationIDKey) => (
  state.chat.get('inbox').find(inbox => inbox.get('conversationIDKey') === selectedConversation)
)

const getTLF = createSelector(
  [getSelectedInbox, getSelectedConversation],
  (selectedInbox, selectedConversation) => {
    if (Constants.isPendingConversationIDKey(selectedConversation)) {
      return Constants.pendingConversationIDKeyToTlfName(selectedConversation) || ''
    } else if (selectedConversation !== Constants.nothingSelected && selectedInbox) {
      return selectedInbox.participants.join(',')
    }
    return ''
  }
)

const getUsers = createSelector(
  [getYou, getTLF, getFollowingMap, getMetaDataMap],
  (you, tlf, followingMap, metaDataMap) => (
    Constants.usernamesToUserListItem(Constants.participantFilter(List(tlf.split(',')), you).toArray(), you, metaDataMap, followingMap)
  )
)

const getMuted = createSelector(
  [getSelectedInbox],
  (selectedInbox) => selectedInbox && selectedInbox.get('status') === 'muted',
)

const mapStateToProps = (state: TypedState, {selectedConversation, sidePanelOpen}: OwnProps) => ({
  muted: getMuted(state, selectedConversation),
  sidePanelOpen,
  users: getUsers(state, selectedConversation),
})

const mapDispatchToProps = (dispatch: Dispatch, {onBack, onToggleSidePanel}: OwnProps) => ({
  onBack,
  onOpenFolder: () => dispatch(Creators.openFolder()),
  onShowProfile: (username: string) => dispatch(onUserClick(username, '')),
  onToggleSidePanel,
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
)(Header)
