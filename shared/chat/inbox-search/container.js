// @flow
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Constants from '../../constants/chat2'
import {namedConnect} from '../../util/container'
import HiddenString from '../../util/hidden-string'
import InboxSearch from '.'

const mapStateToProps = state => {
  const inboxSearch = state.chat2.inboxSearch || Constants.makeInboxSearchInfo()
  return {
    _inboxSearch: inboxSearch,
  }
}

const mapDispatchToProps = dispatch => ({
  onCancel: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: false})),
  onSelectConversation: (conversationIDKey, query) =>
    dispatch(
      Chat2Gen.createInboxSearchSelect({
        conversationIDKey,
        query: query.length > 0 ? new HiddenString(query) : undefined,
      })
    ),
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
  onSelectConversation: dispatchProps.onSelectConversation,
  selectedIndex: stateProps._inboxSearch.selectedIndex,
  textResults: stateProps._inboxSearch.textResults
    .map(r => ({
      conversationIDKey: r.conversationIDKey,
      numHits: r.numHits,
      query: r.query,
      type: r.teamType,
    }))
    .toArray(),
  textStatus: stateProps._inboxSearch.textStatus,
})

export default namedConnect<{}, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'InboxSearch')(
  InboxSearch
)
