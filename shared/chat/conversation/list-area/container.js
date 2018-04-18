// @flow
import * as React from 'react'
import * as SearchConstants from '../../../constants/search'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as TrackerGen from '../../../actions/tracker-gen'
import Normal from './normal/container'
import SearchResultsList from '../../../search/results-list/container'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import {desktopStyles} from '../../../styles'

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  listScrollDownCounter: number,
  onFocusInput: () => void,
  onShowTracker: (user: string) => void,
  showSearchResults: boolean,
  // TODO DESKTOP-6256 get rid of this
  onToggleInfoPanel: () => void,
}

class ListArea extends React.PureComponent<Props> {
  render() {
    if (this.props.showSearchResults) {
      return (
        <SearchResultsList
          searchKey="chatSearch"
          onShowTracker={this.props.onShowTracker}
          style={searchResultStyle}
        />
      )
    } else {
      return (
        <Normal
          listScrollDownCounter={this.props.listScrollDownCounter}
          onFocusInput={this.props.onFocusInput}
          onToggleInfoPanel={this.props.onToggleInfoPanel}
          conversationIDKey={this.props.conversationIDKey}
        />
      )
    }
  }
}

const searchResultStyle = {...desktopStyles.scrollable, flexGrow: 1}

const mapStateToProps = (state: TypedState, {conversationIDKey}): * => {
  let conversationToShow = conversationIDKey
  if (conversationIDKey === Constants.pendingConversationIDKey) {
    // Special case we stash the 'preview' of the chat if it exists in here
    conversationToShow = Constants.getMeta(state, Constants.pendingConversationIDKey).conversationIDKey
  }
  return {
    conversationIDKey: conversationToShow,
    showSearchResults:
      Constants.getSelectedConversation(state) === Constants.pendingConversationIDKey &&
      state.chat2.pendingMode === 'searchingForUsers' &&
      !!SearchConstants.getSearchResultIdsArray(state, {searchKey: 'chatSearch'}),
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onShowTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: false, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    conversationIDKey: stateProps.conversationIDKey,
    listScrollDownCounter: ownProps.listScrollDownCounter,
    onFocusInput: ownProps.onFocusInput,
    onShowTracker: dispatchProps.onShowTracker,
    onToggleInfoPanel: ownProps.onToggleInfoPanel,
    showSearchResults: stateProps.showSearchResults,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(ListArea)
