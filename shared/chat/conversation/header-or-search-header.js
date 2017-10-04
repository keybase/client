// @flow
import * as React from 'react'
import Header from './header/container'
import SearchHeader from '../search-header'
import * as ChatConstants from '../../constants/chat'

type Props = {
  inSearch: boolean,
  selectedConversationIDKey: ?ChatConstants.ConversationIDKey,
  infoPanelOpen: boolean,
  onToggleInfoPanel: () => void,
  onBack: () => void,
  onExitSearch: () => void,
}

export default (props: Props) =>
  props.inSearch
    ? <SearchHeader
        onExitSearch={props.onExitSearch}
        selectedConversationIDKey={props.selectedConversationIDKey}
      />
    : <Header
        infoPanelOpen={props.infoPanelOpen}
        onToggleInfoPanel={props.onToggleInfoPanel}
        onBack={props.onBack}
      />
