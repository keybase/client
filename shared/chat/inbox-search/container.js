// @flow
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Constants from '../../constants/chat2'
import {namedConnect} from '../../util/container'
import InboxSearch from '.'

const mapStateToProps = state => {
  const inboxSearch = state.chat2.inboxSearch || Constants.makeInboxSearchInfo()
  return {
    _inboxSearch: inboxSearch,
  }
}

const mapDispatchToProps = dispatch => ({
  onSelectConversation: (conversationIDKey: Types.ConversationIDKey) =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxSearch'})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  nameStatus: stateProps._inboxSearch.nameStatus,
  nameResults: stateProps._inboxSearch.nameResults
    .map(r => ({
      conversationIDKey: r.conversationIDKey,
      type: r.teamType,
    }))
    .toArray(),
  onSelectConversation: dispatchProps.onSelectConversation,
  selectedIndex: stateProps._inboxSearch.selectedIndex,
  textStatus: stateProps._inboxSearch.textStatus,
  textResults: stateProps._inboxSearch.textResults
    .map(r => ({
      conversationIDKey: r.conversationIDKey,
      type: r.teamType,
    }))
    .toArray(),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'InboxSearch'
)(InboxSearch)
