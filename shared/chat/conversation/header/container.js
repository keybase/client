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
  selectedConversationIDKey: ?Constants.ConversationIDKey,
  sidePanelOpen: boolean,
}

const getYou = (state: TypedState) => state.config.username || ''
const getFollowingMap = (state: TypedState) => state.config.following
const getMetaDataMap = (state: TypedState) => state.chat.get('metaData')
const getSelectedConversation = (_, selected: ?Constants.ConversationIDKey) => selected
const getSelectedInbox = (state: TypedState, selected: ?Constants.ConversationIDKey) => (
  state.chat.get('inbox').find(inbox => inbox.get('conversationIDKey') === selected)
)

const getTLF = createSelector(
  [getSelectedInbox, getSelectedConversation],
  (selectedInbox, selected) => {
    if (Constants.isPendingConversationIDKey(selected)) {
      return Constants.pendingConversationIDKeyToTlfName(selected) || ''
    } else if (selected !== Constants.nothingSelected && selectedInbox) {
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

const mapStateToProps = (state: TypedState, {selectedConversationIDKey, sidePanelOpen}: OwnProps) => ({
  muted: getMuted(state, selectedConversationIDKey),
  sidePanelOpen,
  users: getUsers(state, selectedConversationIDKey),
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
