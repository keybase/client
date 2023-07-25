import * as RouterConstants from '../../constants/router2'
import * as Constants from '../../constants/chat2'
import InboxSearch from '.'
import * as React from 'react'
import type * as Types from '../../constants/types/chat2'

type OwnProps = {
  header?: React.ReactElement | null
}

const emptySearch = Constants.makeInboxSearchInfo()

export default (ownProps: OwnProps) => {
  const _inboxSearch = Constants.useState(s => s.inboxSearch ?? emptySearch)
  const toggleInboxSearch = Constants.useState(s => s.dispatch.toggleInboxSearch)
  const inboxSearchSelect = Constants.useState(s => s.dispatch.inboxSearchSelect)
  const onCancel = () => {
    toggleInboxSearch(false)
  }
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onInstallBot = (username: string) => {
    navigateAppend({props: {botUsername: username}, selected: 'chatInstallBotPick'})
  }
  const onSelectConversation = (
    conversationIDKey: Types.ConversationIDKey,
    selectedIndex: number,
    query: string
  ) => {
    inboxSearchSelect(conversationIDKey, query.length > 0 ? query : undefined, selectedIndex)
  }
  const {header} = ownProps
  const {indexPercent, nameResults, nameResultsUnread, nameStatus, textStatus} = _inboxSearch
  const {botsResults, botsResultsSuggested, botsStatus} = _inboxSearch
  const {openTeamsResults, openTeamsResultsSuggested, openTeamsStatus} = _inboxSearch
  const {query, selectedIndex, textResults} = _inboxSearch
  const props = {
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
    query,
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
  return <InboxSearch {...props} />
}
