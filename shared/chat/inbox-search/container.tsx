import * as React from 'react'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import {namedConnect} from '../../util/container'
import HiddenString from '../../util/hidden-string'
import InboxSearch from '.'

type OwnProps = {
  header?: React.ReactNode
}

export default namedConnect(
  state => ({
    _inboxSearch: state.chat2.inboxSearch || Constants.makeInboxSearchInfo(),
  }),
  dispatch => ({
    onCancel: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: false})),
    onSelectConversation: (
      conversationIDKey: Types.ConversationIDKey,
      selectedIndex: number,
      query: string
    ) =>
      dispatch(
        Chat2Gen.createInboxSearchSelect({
          conversationIDKey,
          query: query.length > 0 ? new HiddenString(query) : undefined,
          selectedIndex,
        })
      ),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    header: ownProps.header,
    indexPercent: stateProps._inboxSearch.indexPercent,
    nameResults: stateProps._inboxSearch.nameResults.map(r => ({
      conversationIDKey: r.conversationIDKey,
      name: r.name,
      type: r.teamType,
    })),
    nameResultsUnread: stateProps._inboxSearch.nameResultsUnread,
    nameStatus: stateProps._inboxSearch.nameStatus,
    onCancel: dispatchProps.onCancel,
    onSelectConversation: dispatchProps.onSelectConversation,
    query: stateProps._inboxSearch.query.stringValue(),
    selectedIndex: stateProps._inboxSearch.selectedIndex,
    textResults: stateProps._inboxSearch.textResults.map(r => ({
      conversationIDKey: r.conversationIDKey,
      name: r.name,
      numHits: r.numHits,
      query: r.query,
      type: r.teamType,
    })),
    textStatus: stateProps._inboxSearch.textStatus,
  }),
  'InboxSearch'
)(InboxSearch)
