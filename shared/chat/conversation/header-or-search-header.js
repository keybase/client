// @flow
import React from 'react'
import Header from './header/container'
import _SearchHeader from '../../search/user-input/container'
import {compose, withState, lifecycle} from 'recompose'
import * as ChatConstants from '../../constants/chat'

type Props = {
  inSearch: boolean,
  selectedConversationIDKey: ?ChatConstants.ConversationIDKey,
  infoPanelOpen: boolean,
  onToggleInfoPanel: () => void,
  onBack: () => void,
  onExitSearch: () => void,
}

const SearchHeader = compose(
  withState('focusInputCounter', 'setCounter', 0),
  lifecycle({
    componentWillReceiveProps(nextProps: Props & {setCounter: (fn: (n: number) => number) => void}) {
      if (this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey) {
        nextProps.setCounter((n: number) => n + 1)
      }
    },
  })
)(_SearchHeader)

export default (props: Props) =>
  props.inSearch
    ? <SearchHeader
        searchKey="chatSearch"
        onExitSearch={props.onExitSearch}
        selectedConversationIDKey={props.selectedConversationIDKey}
      />
    : <Header
        infoPanelOpen={props.infoPanelOpen}
        onToggleInfoPanel={props.onToggleInfoPanel}
        onBack={props.onBack}
      />
