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
  _onSelectConversation: ({conversationIDKey, query}) =>
    dispatch(Chat2Gen.createInboxSearchSelect({conversationIDKey, query})),
  onCancel: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: false})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  indexPercent: stateProps._inboxSearch.indexPercent,
  nameResults: stateProps._inboxSearch.nameResults
    .map(r => ({
      conversationIDKey: r.conversationIDKey,
      type: r.teamType,
    }))
    .toArray(),
  nameStatus: stateProps._inboxSearch.nameStatus,
  onCancel: dispatchProps.onCancel,
  onSelectConversation: (conversationIDKey, textHit) =>
    dispatchProps._onSelectConversation({
      conversationIDKey,
      query: textHit ? stateProps._inboxSearch.query : undefined,
    }),
  selectedIndex: stateProps._inboxSearch.selectedIndex,
  textResults: stateProps._inboxSearch.textResults
    .map(r => ({
      conversationIDKey: r.conversationIDKey,
      numHits: r.numHits,
      type: r.teamType,
    }))
    .toArray(),
  textStatus: stateProps._inboxSearch.textStatus,
})

export default namedConnect<{}, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'InboxSearch')(
  InboxSearch
)
