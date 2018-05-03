// @flow
import * as React from 'react'
import * as SearchConstants from '../../../constants/search'
import * as Types from '../../../constants/types/chat2'
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
          conversationIDKey={this.props.conversationIDKey}
        />
      )
    }
  }
}

const searchResultStyle = {...desktopStyles.scrollable, flexGrow: 1}

const mapStateToProps = (state: TypedState): * => ({
  showSearchResults:
    state.chat2.pendingSelected &&
    state.chat2.pendingMode === 'searchingForUsers' &&
    !!SearchConstants.getSearchResultIdsArray(state, {searchKey: 'chatSearch'}),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onShowTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: false, username})),
})

export default connect(mapStateToProps, mapDispatchToProps)(ListArea)
