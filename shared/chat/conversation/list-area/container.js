// @flow
import * as React from 'react'
import * as SearchConstants from '../../../constants/search'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as ProfileGen from '../../../actions/profile-gen'
import * as TrackerGen from '../../../actions/tracker-gen'
import Normal from './normal/container'
import SearchResultsList from '../../../search/results-list/container'
import {connect, isMobile} from '../../../util/container'
import {desktopStyles} from '../../../styles'
import StartConversation from './start-conversation/container'
import Waiting from './waiting'

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  listScrollDownCounter: number,
  onFocusInput: () => void,
  onShowTracker: (user: string) => void,
  type: 'search' | 'normal' | 'start' | 'waiting',
}

class ListArea extends React.PureComponent<Props> {
  render() {
    switch (this.props.type) {
      case 'search':
        return (
          <SearchResultsList
            searchKey="chatSearch"
            onShowTracker={this.props.onShowTracker}
            style={searchResultStyle}
          />
        )
      case 'normal':
        return (
          <Normal
            listScrollDownCounter={this.props.listScrollDownCounter}
            onFocusInput={this.props.onFocusInput}
            conversationIDKey={this.props.conversationIDKey}
          />
        )
      case 'start':
        return <StartConversation conversationIDKey={this.props.conversationIDKey} />
      case 'waiting':
        return <Waiting />
      default:
        /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(this.props.type);
      */
        return null
    }
  }
}

const searchResultStyle = {...desktopStyles.scrollable, flexGrow: 1}

const mapStateToProps = (state, {conversationIDKey}) => {
  let type
  let conversationIDKeyToShow = conversationIDKey
  if (
    conversationIDKey === Constants.pendingConversationIDKey &&
    state.chat2.pendingMode === 'searchingForUsers' &&
    !!SearchConstants.getSearchResultIdsArray(state, {searchKey: 'chatSearch'})
  ) {
    // There are search results; show list
    type = 'search'
  } else {
    if (conversationIDKey === Constants.pendingConversationIDKey) {
      const resolvedPendingConversationIDKey = Constants.getResolvedPendingConversationIDKey(state)
      const inputResults = SearchConstants.getUserInputItemIds(state, {searchKey: 'chatSearch'})
      switch (resolvedPendingConversationIDKey) {
        case Constants.noConversationIDKey:
          if (state.chat2.pendingMode === 'searchingForUsers' && !inputResults.length) {
            // No search results + no users in input; show spinner
            type = 'waiting'
            break
          }
          // No search results + some users in input; show start button
          type = 'start'
          break
        case Constants.pendingWaitingConversationIDKey:
          // No search results + waiting for convo to be created; show spinner
          type = 'waiting'
          break
        default:
          // No search results + convo exists; show thread
          type = 'normal'
          conversationIDKeyToShow = resolvedPendingConversationIDKey
          break
      }
    } else {
      type = 'normal'
    }
  }

  return {
    conversationIDKey: conversationIDKeyToShow,
    type,
  }
}

const mapDispatchToProps = dispatch => ({
  onShowTracker: (username: string) =>
    isMobile
      ? dispatch(ProfileGen.createShowUserProfile({username}))
      : dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: false, username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    conversationIDKey: stateProps.conversationIDKey,
    listScrollDownCounter: ownProps.listScrollDownCounter,
    onFocusInput: ownProps.onFocusInput,
    onShowTracker: dispatchProps.onShowTracker,
    type: stateProps.type,
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(ListArea)
