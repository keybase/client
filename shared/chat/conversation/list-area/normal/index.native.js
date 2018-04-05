// @flow
import * as React from 'react'
import Message from '../../messages'
import SpecialTopMessage from '../../messages/special-top-message'
import SpecialBottomMessage from '../../messages/special-bottom-message'
import {Box, NativeVirtualizedList, ErrorBoundary} from '../../../../common-adapters/index.native'

import type {Props} from '.'

class ConversationList extends React.PureComponent<Props> {
  _renderItem = ({index, item}) => {
    if (item === 'specialTop') {
      return (
        <SpecialTopMessage
          onToggleInfoPanel={this.props.onToggleInfoPanel}
          conversationIDKey={this.props.conversationIDKey}
          measure={null}
        />
      )
    } else if (item === 'specialBottom') {
      return <SpecialBottomMessage conversationIDKey={this.props.conversationIDKey} measure={null} />
    } else {
      const ordinalIndex = item
      const ordinal = this.props.messageOrdinals.get(ordinalIndex)
      const prevOrdinal = ordinalIndex > 0 ? this.props.messageOrdinals.get(ordinalIndex - 1) : null

      return (
        <Message
          ordinal={ordinal}
          previous={prevOrdinal}
          measure={null}
          conversationIDKey={this.props.conversationIDKey}
        />
      )
    }
  }

  _getItem = (messageOrdinals, index) => {
    // Note we invert our list so we need to feed it things in the reverse order. We just invert the index
    // vs reversing the items to speed things up
    const itemCountIncludingSpecial = this._getItemCount(messageOrdinals)
    if (index === itemCountIncludingSpecial - 1) {
      return 'specialTop'
    } else if (index === 0) {
      return 'specialBottom'
    }

    // return ordinalIndex
    return itemCountIncludingSpecial - index - 2
  }

  _getItemCount = messageOrdinals => (messageOrdinals ? messageOrdinals.size + 2 : 2)

  _keyExtractor = item => {
    if (item === 'specialTop') {
      return 'specialTop'
    }
    if (item === 'specialBottom') {
      return 'specialBottom'
    }
    return String(this.props.messageOrdinals.get(item))
  }

  // Was using onEndReached but that was really flakey
  _onViewableItemsChanged = ({viewableItems}) => {
    const topRecord = viewableItems[viewableItems.length - 1]
    if (topRecord && topRecord.item === 'specialTop') {
      const ordinalRecord = viewableItems[viewableItems.length - 2] || {}
      this.props.loadMoreMessages(this.props.messageOrdinals.get(ordinalRecord.item))
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
