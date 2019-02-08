// @flow
import * as React from 'react'
import * as SearchConstants from '../../../constants/search'
import * as Flow from '../../../util/flow'
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

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  isPending: boolean,
  scrollListDownCounter: number,
  scrollListUpCounter: number,
  onFocusInput: () => void,
|}

type Props = {
  conversationIDKey: Types.ConversationIDKey,
  scrollListDownCounter: number,
  scrollListUpCounter: number,
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
            scrollListDownCounter={this.props.scrollListDownCounter}
            scrollListUpCounter={this.props.scrollListUpCounter}
            onFocusInput={this.props.onFocusInput}
            conversationIDKey={this.props.conversationIDKey}
          />
        )
      case 'start':
        return <StartConversation conversationIDKey={this.props.conversationIDKey} />
      case 'waiting':
        return <Waiting />
      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(this.props.type)
        return null
    }
  }
}

const searchResultStyle = {...desktopStyles.scrollable, flexGrow: 1}

const mapStateToProps = (state, {conversationIDKey, isPending}) => {
  let type
  if (
    isPending &&
    state.chat2.pendingMode === 'searchingForUsers' &&
    !!SearchConstants.getSearchResultIds(state, 'chatSearch')
  ) {
    // There are search results; show list
    type = 'search'
  } else {
    if (isPending) {
      const inputResults = SearchConstants.getUserInputItemIds(state, 'chatSearch')
      switch (conversationIDKey) {
        case Constants.pendingConversationIDKey: // fallthrough
        case Constants.noConversationIDKey:
          if (state.chat2.pendingMode === 'newTeamBuilding') {
            type = 'waiting'
            break
          } else if (state.chat2.pendingMode === 'searchingForUsers' && !inputResults.size) {
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
          break
      }
    } else {
      type = 'normal'
    }
  }

  return {
    conversationIDKey,
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
    onFocusInput: ownProps.onFocusInput,
    onShowTracker: dispatchProps.onShowTracker,
    scrollListDownCounter: ownProps.scrollListDownCounter,
    scrollListUpCounter: ownProps.scrollListUpCounter,
    type: stateProps.type,
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(ListArea)
