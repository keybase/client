import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import Message from '../../messages'
import SpecialTopMessage from '../../messages/special-top-message'
import SpecialBottomMessage from '../../messages/special-bottom-message'
import {mobileTypingContainerHeight} from '../../input-area/normal/typing'
import {Box, NativeVirtualizedList, ErrorBoundary} from '../../../../common-adapters/mobile.native'
import logger from '../../../../logger'
import * as Styles from '../../../../styles'
import {Props} from './index.types'
import JumpToRecent from './jump-to-recent'

const debugEnabled = false

const _debug = debugEnabled ? s => logger.debug('_scroll: ' + s) : () => {}

const targetHitArea = 1

class ConversationList extends React.PureComponent<Props> {
  _listRef = React.createRef<NativeVirtualizedList<Types.Ordinal | 'specialTop' | 'specialBottom'>>()
  _scrollCenterTarget?: number

  _renderItem = ({item}) => {
    if (item === 'specialTop') {
      return <SpecialTopMessage conversationIDKey={this.props.conversationIDKey} measure={null} />
    } else if (item === 'specialBottom') {
      return <SpecialBottomMessage conversationIDKey={this.props.conversationIDKey} measure={null} />
    } else {
      const ordinalIndex = item
      const ordinal = this.props.messageOrdinals.get(ordinalIndex)
      const prevOrdinal = ordinalIndex > 0 ? this.props.messageOrdinals.get(ordinalIndex - 1) : undefined

      if (!ordinal) {
        return null
      }

      return (
        <Message
          key={ordinal}
          ordinal={ordinal}
          previous={prevOrdinal}
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

  _getIndexFromItem = item => {
    return this._getItemCount(this.props.messageOrdinals) - item - 2
  }

  _getOrdinalIndex = target => {
    for (let item = 0; item < this.props.messageOrdinals.size; item++) {
      const ordinal = this.props.messageOrdinals.get(item, 0)
      if (ordinal === target) {
        return this._getIndexFromItem(item)
      }
    }
    return -1
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
    const bottomRecord = viewableItems[0]
    // we scroll back in time if the specialTop item is the last viewable, *unless* we are currently
    // attempting to scroll to a centered ordinal
    if (!this._scrollCenterTarget && topRecord && topRecord.item === 'specialTop') {
      const ordinalRecord = viewableItems[viewableItems.length - 2]
      // ignore if we don't have real messages
      if (ordinalRecord && ordinalRecord.item !== 'specialBottom') {
        this.props.loadOlderMessages(this.props.messageOrdinals.get(ordinalRecord.item))
      }
    }
    if (!topRecord || !bottomRecord) {
      _debug(`_onViewableItemsChanged: bailing out because of no record`)
      return
    }

    const bottomIndex = this._getIndexFromItem(viewableItems[0].item)
    const upperIndex = this._getIndexFromItem(viewableItems[viewableItems.length - 1].item)
    const middleIndex = bottomIndex + Math.floor((upperIndex - bottomIndex) / 2)
    _debug(`_onViewableItemsChanged: first: ${bottomIndex} last: ${upperIndex} middle: ${middleIndex}`)
    if (!this._scrollCenterTarget) {
      _debug(`_onViewableItemsChanged: no center target`)
      return
    }

    if (
      !(
        this._scrollCenterTarget <= middleIndex + targetHitArea &&
        this._scrollCenterTarget >= middleIndex - targetHitArea
      )
    ) {
      _debug(`_onViewableItemsChanged: scrolling to: ${this._scrollCenterTarget}`)
      this._scrollToCentered()
    } else {
      _debug(`_onViewableItemsChanged: cleared`)
      this._scrollCenterTarget = undefined
    }
  }

  // not highly documented. keeps new content from shifting around the list if you're scrolled up
  _maintainVisibleContentPosition = {
    minIndexForVisible: 0,
  }

  _jumpToRecent = () => {
    const list = this._listRef.current
    if (list) {
      const index = this._getOrdinalIndex(this.props.messageOrdinals.last())
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
    const index = this._getOrdinalIndex(this.props.centeredOrdinal)
    if (index >= 0) {
      _debug(`_scrollToCentered: ordinal: ${this.props.centeredOrdinal} index: ${index}`)
      this._scrollCenterTarget = index
      list.scrollToIndex({animated: false, index, viewPosition: 0.5})
    }
  }

  _onScrollToIndexFailed = (info: {
    index: number
    highestMeasuredFrameIndex: number
    averageItemLength: number
  }) => {
    logger.warn(
      `_scroll: _onScrollToIndexFailed: failed to scroll to index: centeredOrdinal: ${Types.ordinalToNumber(
        this.props.centeredOrdinal || Types.numberToOrdinal(0)
      )} arg: ${JSON.stringify(info)}`
    )
    const list = this._listRef.current
    if (list) {
      list.scrollToIndex({animated: false, index: info.highestMeasuredFrameIndex})
    }
  }

  componentDidUpdate(prevProps: Props) {
    // if the ordinals are the same but something changed, attempt to scroll to centered
    _debug(
      `componentDidUpdate: center: ${this.props.centeredOrdinal} oldCenter: ${
        prevProps.centeredOrdinal
      } first: ${this.props.messageOrdinals.first()} last: ${this.props.messageOrdinals.last()} oldFirst: ${prevProps.messageOrdinals.first()} oldLast: ${prevProps.messageOrdinals.last()}`
    )
    if (!!this.props.centeredOrdinal && this.props.centeredOrdinal !== prevProps.centeredOrdinal) {
      _debug(`componentDidUpdate: attempting scroll`)
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
            ref={this._listRef}
            onScrollToIndexFailed={this._onScrollToIndexFailed}
            removeClippedSubviews={Styles.isAndroid}
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
