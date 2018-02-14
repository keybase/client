// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import Message from '../../messages'
import {Box, NativeVirtualizedList, ErrorBoundary} from '../../../../common-adapters/index.native'

import type {Props} from '.'

const blankOrdinal = Types.numberToOrdinal(0)

class ConversationList extends React.PureComponent<Props> {
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
  _getItem = (messageOrdinals, index) => messageOrdinals.get(index)
  _getItemCount = messageOrdinals => messageOrdinals.size + (this.props.hasExtraRow ? 1 : 0)
  _keyExtractor = ordinal => String(ordinal)

  // Don't load if we have no messages in there. This happens a lot when we're dealing with stale messages
  _onEndReached = () => {
    if (this.props.messageOrdinals.size > 1) {
      this.props.loadMoreMessages()
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
            onEndReached={this._onEndReached}
            onEndReachedThreshold={0}
            keyExtractor={this._keyExtractor}
            // Limit the number of pages rendered ahead of time (which also limits attachment previews loaded)
            windowSize={5}
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
