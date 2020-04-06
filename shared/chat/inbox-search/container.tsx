import * as React from 'react'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import {namedConnect} from '../../util/container'
import HiddenString from '../../util/hidden-string'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import InboxSearch from '.'

type OwnProps = {
  header?: React.ReactElement | null
}

const emptySearch = Constants.makeInboxSearchInfo()

export default namedConnect(
  state => ({_inboxSearch: state.chat2.inboxSearch ?? emptySearch}),
  dispatch => ({
    onCancel: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: false})),
    onInstallBot: (username: string) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {botUsername: username, navToChat: false}, selected: 'chatInstallBotPick'}],
        })
      ),
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
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {header} = ownProps
    const {_inboxSearch} = stateProps
    const {indexPercent, nameResults, nameResultsUnread, nameStatus, textStatus} = _inboxSearch
    const {botsResults, botsResultsSuggested, botsStatus} = _inboxSearch
    const {openTeamsResults, openTeamsResultsSuggested, openTeamsStatus} = _inboxSearch
    const {query, selectedIndex, textResults} = _inboxSearch
    const {onCancel, onInstallBot, onSelectConversation} = dispatchProps
    return {
      botsResults,
      botsResultsSuggested,
      botsStatus,
      header,
      indexPercent,
      nameResults: nameResults.map(r => ({
        conversationIDKey: r.conversationIDKey,
        name: r.name,
        type: r.teamType,
      })),
      nameResultsUnread,
      nameStatus,
      onCancel,
      onInstallBot,
      onSelectConversation,
      openTeamsResults,
      openTeamsResultsSuggested,
      openTeamsStatus,
      query: query.stringValue(),
      selectedIndex,
      textResults: textResults.map(r => ({
        conversationIDKey: r.conversationIDKey,
        name: r.name,
        numHits: r.numHits,
        query: r.query,
        type: r.teamType,
      })),
      textStatus,
    }
  },
  'InboxSearch'
)(InboxSearch)
