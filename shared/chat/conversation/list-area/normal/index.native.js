// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import Message from '../../messages'
import {Box, NativeVirtualizedList, ErrorBoundary} from '../../../../common-adapters/index.native'

import type {Props} from '.'

const blankOrdinal = Types.numberToOrdinal(0)
type State = {
  calledLoadMoreDueToOrdinal: ?Types.Ordinal,
}

class ConversationList extends React.PureComponent<Props, State> {
  state = {
    calledLoadMoreDueToOrdinal: null,
  }

  _renderItem = ({index}) => {
    const i = this.props.hasExtraRow ? index - 1 : index
    const ordinal = i < 0 ? blankOrdinal : this.props.messageOrdinals.get(i, blankOrdinal)
    const prevOrdinal = this.props.messageOrdinals.get(i + 1, blankOrdinal)
    return (
      <Message
        ordinal={ordinal}
        previous={prevOrdinal}
        conversationIDKey={this.props.conversationIDKey}
        measure={null}
      />
    )
  }
  _getItem = (messageOrdinals, index) => (messageOrdinals ? messageOrdinals.get(index) : null)
  _getItemCount = messageOrdinals =>
    messageOrdinals ? messageOrdinals.size + (this.props.hasExtraRow ? 1 : 0) : 0
  _keyExtractor = ordinal => String(ordinal)

  // Was using onEndReached but that was really flakey
  _onViewableItemsChanged = ({viewableItems}) => {
    const top = viewableItems[viewableItems.length - 1]
    if (top) {
      const ordinal = top.item
      if (
        ordinal === this.props.messageOrdinals.last() &&
        ordinal !== this.state.calledLoadMoreDueToOrdinal
      ) {
        this.setState({calledLoadMoreDueToOrdinal: ordinal})
        console.log('aaa calling load more', ordinal, top)
        this.props.loadMoreMessages()
      }
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.conversationIDKey !== nextProps.conversationIDKey) {
      this.setState({calledLoadMoreDueToOrdinal: null})
    }
  }

  render() {
    return (
      <ErrorBoundary>
        <Box style={containerStyle}>
          <NativeVirtualizedList
            data={this.props.messageOrdinals}
            inverted={true}
            getItem={this._getItem}
            getItemCount={this._getItemCount}
            renderItem={this._renderItem}
            onViewableItemsChanged={this._onViewableItemsChanged}
            keyExtractor={this._keyExtractor}
            // Limit the number of pages rendered ahead of time (which also limits attachment previews loaded)
            windowSize={5}
            removeClippedSubviews={true}
          />
        </Box>
      </ErrorBoundary>
    )
  }
}

const containerStyle = {
  flex: 1,
}

export default ConversationList
