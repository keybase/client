// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import Message from '../../messages'
import SpecialTopMessage from '../../messages/special-top-message'
import SpecialBottomMessage from '../../messages/special-bottom-message'
import {mobileTypingContainerHeight} from '../../input-area/normal/typing'
import {Box, NativeVirtualizedList, ErrorBoundary} from '../../../../common-adapters/mobile.native'
import logger from '../../../../logger'
import * as Styles from '../../../../styles'
import type {Props} from './index.types'
import JumpToRecent from './jump-to-recent'

class ConversationList extends React.PureComponent<Props> {
  _listRef = React.createRef()
  _lastCenteredOrdinal = 0

  _renderItem = ({index, item}) => {
    if (item === 'specialTop') {
      return <SpecialTopMessage conversationIDKey={this.props.conversationIDKey} measure={null} />
    } else if (item === 'specialBottom') {
      return <SpecialBottomMessage conversationIDKey={this.props.conversationIDKey} measure={null} />
    } else {
      const ordinalIndex = item
      const ordinal = this.props.messageOrdinals.get(ordinalIndex)
      const prevOrdinal = ordinalIndex > 0 ? this.props.messageOrdinals.get(ordinalIndex - 1) : null

      return (
        <Message
          key={ordinal}
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
    const ordinalIndex = itemCountIncludingSpecial - index - 2
    return ordinalIndex
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
      const ordinalRecord = viewableItems[viewableItems.length - 2]
      // ignore if we don't have real messages
      if (ordinalRecord && ordinalRecord.item !== 'specialBottom') {
        this.props.loadOlderMessages(this.props.messageOrdinals.get(ordinalRecord.item))
      }
    }
    // if things have changed on the screen, then try to scroll to centered ordinal if applicable
    this._scrollToCentered()
  }

  // not highly documented. keeps new content from shifting around the list if you're scrolled up
  _maintainVisibleContentPosition = {
    minIndexForVisible: 0,
  }

  _getOrdinalIndex = target => {
    const itemCount = this._getItemCount(this.props.messageOrdinals)
    for (let ordinalIndex = 0; ordinalIndex < this.props.messageOrdinals.size; ordinalIndex++) {
      const ordinal = this.props.messageOrdinals.get(ordinalIndex, 0)
      if (ordinal === target) {
        return itemCount - ordinalIndex - 2
      }
    }
    return -1
  }

  _jumpToRecent = () => {
    const list = this._listRef.current
    if (list) {
      const index = this._getOrdinalIndex(this.props.messageOrdinals.first())
      if (index >= 0) {
        list.scrollToIndex({index})
      }
    }
    this.props.onJumpToRecent()
  }

  _scrollToCentered = () => {
    const list = this._listRef.current
    if (!list) {
      return
    }
    // If the centered ordinal is set and different than previous, try to scroll to the corresponding
    // index
    if (!!this.props.centeredOrdinal && this.props.centeredOrdinal !== this._lastCenteredOrdinal) {
      const index = this._getOrdinalIndex(this.props.centeredOrdinal)
      if (index >= 0) {
        this._lastCenteredOrdinal = this.props.centeredOrdinal
        list.scrollToIndex({index, viewPosition: 0.5})
      }
    }
  }

  _onScrollToIndexFailed = (info: {
    index: number,
    highestMeasuredFrameIndex: number,
    averageItemLength: number,
  }) => {
    logger.warn(
      `_onScrollToIndexFailed: failed to scroll to index: centeredOrdinal: ${Types.ordinalToNumber(
        this.props.centeredOrdinal || Types.numberToOrdinal(0)
      )} arg: ${JSON.stringify(info)}`
    )
  }

  componentDidUpdate(prevProps: Props) {
    // if the ordinals are the same but something changed, attempt to scroll to centered
    if (
      this.props.messageOrdinals.first() === prevProps.messageOrdinals.first() &&
      this.props.messageOrdinals.last() === prevProps.messageOrdinals.last()
    ) {
      this._scrollToCentered()
    }
  }

  render() {
    return (
      <ErrorBoundary>
        <Box style={styles.container}>
          <NativeVirtualizedList
            contentContainerStyle={styles.contentContainer}
            data={this.props.messageOrdinals}
            inverted={true}
            getItem={this._getItem}
            getItemCount={this._getItemCount}
            renderItem={this._renderItem}
            maintainVisibleContentPosition={this._maintainVisibleContentPosition}
            onViewableItemsChanged={this._onViewableItemsChanged}
            keyboardShouldPersistTaps="handled"
            keyExtractor={this._keyExtractor}
            // Limit the number of pages rendered ahead of time (which also limits attachment previews loaded)
            windowSize={5}
            removeClippedSubviews={true}
            forwardedRef={this._listRef}
            onScrollToIndexFailed={this._onScrollToIndexFailed}
          />
          {!this.props.containsLatestMessage && this.props.messageOrdinals.size > 0 && (
            <JumpToRecent onClick={this._jumpToRecent} style={styles.jumpToRecent} />
          )}
        </Box>
      </ErrorBoundary>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    flex: 1,
    position: 'relative',
  },
  contentContainer: {
    bottom: -mobileTypingContainerHeight,
  },
  jumpToRecent: {
    bottom: 0,
    position: 'absolute',
  },
})

export default ConversationList
