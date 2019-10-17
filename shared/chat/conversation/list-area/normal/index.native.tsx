import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import Message from '../../messages'
import SpecialTopMessage from '../../messages/special-top-message'
import SpecialBottomMessage from '../../messages/special-bottom-message'
import {mobileTypingContainerHeight} from '../../input-area/normal/typing'
import * as Kb from '../../../../common-adapters/mobile.native'
import * as Container from '../../../../util/container'
import {Animated} from 'react-native'
import logger from '../../../../logger'
import * as Styles from '../../../../styles'
import {Props} from '.'
import JumpToRecent from './jump-to-recent'

const debugEnabled = false

const debug = debugEnabled ? s => logger.debug('scroll: ' + s) : () => {}

const targetHitArea = 1

// only animate one node once, ever, once it has a height
let animatingConversationIDKey = null
let animatingOrdinal = null

const AnimatedChild = React.memo(({children}) => {
  console.log('aaa sent CCHILD render', children)
  const translateY = new Animated.Value(999)
  translateY.addListener(i => console.log('aaa translate animating', i.value))
  // onLayout={e => setHeight(e.layout.height)}
  return (
    <Animated.View
      style={{overflow: 'hidden', transform: [{translateY}], width: '100%'}}
      onLayout={e => {
        const {height} = e.nativeEvent.layout
        translateY.setValue(height + 20)
        Animated.timing(translateY, {
          duration: 300,
          toValue: 0,
          useNativeDriver: true,
        }).start()
      }}
    >
      {children}
    </Animated.View>
  )
})

const Sent = React.memo(({children, conversationIDKey, ordinal}) => {
  console.log('aaa sent render', conversationIDKey, ordinal)
  const {message, you} = Container.useSelector(state => ({
    message: state.chat2.messageMap.getIn([conversationIDKey, ordinal]),
    you: state.config.username,
  }))
  const youSent = message && message.author === you && message.ordinal !== message.id

  if (youSent) {
    return <AnimatedChild>{children}</AnimatedChild>
  } else {
    return children
  }
})

class ConversationList extends React.PureComponent<Props> {
  private listRef = React.createRef<
    Kb.NativeVirtualizedList<Types.Ordinal | 'specialTop' | 'specialBottom'>
  >()
  private scrollCenterTarget?: number

  private renderItem = ({item}) => {
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

      if (this.props.messageOrdinals.size - 1 === ordinalIndex) {
        return (
          <Sent key={ordinal} ordinal={ordinal} conversationIDKey={this.props.conversationIDKey}>
            <Message
              key={ordinal}
              ordinal={ordinal}
              previous={prevOrdinal}
              conversationIDKey={this.props.conversationIDKey}
            />
          </Sent>
        )
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

  private getItem = (messageOrdinals, index) => {
    // Note we invert our list so we need to feed it things in the reverse order. We just invert the index
    // vs reversing the items to speed things up
    const itemCountIncludingSpecial = this.getItemCount(messageOrdinals)
    if (index === itemCountIncludingSpecial - 1) {
      return 'specialTop'
    } else if (index === 0) {
      return 'specialBottom'
    }

    // return ordinalIndex
    const ordinalIndex = itemCountIncludingSpecial - index - 2
    return ordinalIndex
  }

  private getIndexFromItem = item => {
    return this.getItemCount(this.props.messageOrdinals) - item - 2
  }

  private getOrdinalIndex = target => {
    for (let item = 0; item < this.props.messageOrdinals.size; item++) {
      const ordinal = this.props.messageOrdinals.get(item, 0)
      if (ordinal === target) {
        return this.getIndexFromItem(item)
      }
    }
    return -1
  }

  private getItemCount = messageOrdinals => (messageOrdinals ? messageOrdinals.size + 2 : 2)

  private keyExtractor = item => {
    if (item === 'specialTop') {
      return 'specialTop'
    }
    if (item === 'specialBottom') {
      return 'specialBottom'
    }
    return String(this.props.messageOrdinals.get(item))
  }

  // Was using onEndReached but that was really flakey
  private onViewableItemsChanged = ({viewableItems}) => {
    const topRecord = viewableItems[viewableItems.length - 1]
    const bottomRecord = viewableItems[0]
    // we scroll back in time if the specialTop item is the last viewable, *unless* we are currently
    // attempting to scroll to a centered ordinal
    if (!this.scrollCenterTarget && topRecord && topRecord.item === 'specialTop') {
      const ordinalRecord = viewableItems[viewableItems.length - 2]
      // ignore if we don't have real messages
      if (ordinalRecord && ordinalRecord.item !== 'specialBottom') {
        this.props.loadOlderMessages(this.props.messageOrdinals.get(ordinalRecord.item))
      }
    }
    if (!topRecord || !bottomRecord) {
      debug(`onViewableItemsChanged: bailing out because of no record`)
      return
    }

    const bottomIndex = this.getIndexFromItem(viewableItems[0].item)
    const upperIndex = this.getIndexFromItem(viewableItems[viewableItems.length - 1].item)
    const middleIndex = bottomIndex + Math.floor((upperIndex - bottomIndex) / 2)
    debug(`onViewableItemsChanged: first: ${bottomIndex} last: ${upperIndex} middle: ${middleIndex}`)
    if (!this.scrollCenterTarget) {
      debug(`onViewableItemsChanged: no center target`)
      return
    }

    if (
      !(
        this.scrollCenterTarget <= middleIndex + targetHitArea &&
        this.scrollCenterTarget >= middleIndex - targetHitArea
      )
    ) {
      debug(`onViewableItemsChanged: scrolling to: ${this.scrollCenterTarget}`)
      this.scrollToCentered()
    } else {
      debug(`onViewableItemsChanged: cleared`)
      this.scrollCenterTarget = undefined
    }
  }

  // not highly documented. keeps new content from shifting around the list if you're scrolled up
  private maintainVisibleContentPosition = {
    minIndexForVisible: 0,
  }

  private jumpToRecent = () => {
    const list = this.listRef.current
    if (list) {
      const index = this.getOrdinalIndex(this.props.messageOrdinals.last())
      if (index >= 0) {
        list.scrollToIndex({index})
      }
    }
    this.props.onJumpToRecent()
  }

  private scrollToCentered = () => {
    const list = this.listRef.current
    if (!list) {
      return
    }
    const index = this.getOrdinalIndex(this.props.centeredOrdinal)
    if (index >= 0) {
      debug(`scrollToCentered: ordinal: ${this.props.centeredOrdinal} index: ${index}`)
      this.scrollCenterTarget = index
      list.scrollToIndex({animated: false, index, viewPosition: 0.5})
    }
  }

  private onScrollToIndexFailed = (info: {
    index: number
    highestMeasuredFrameIndex: number
    averageItemLength: number
  }) => {
    logger.warn(
      `scroll: onScrollToIndexFailed: failed to scroll to index: centeredOrdinal: ${Types.ordinalToNumber(
        this.props.centeredOrdinal || Types.numberToOrdinal(0)
      )} arg: ${JSON.stringify(info)}`
    )
    const list = this.listRef.current
    if (list) {
      list.scrollToIndex({animated: false, index: info.highestMeasuredFrameIndex})
    }
  }

  componentDidUpdate(prevProps: Props) {
    // if the ordinals are the same but something changed, attempt to scroll to centered
    debug(
      `componentDidUpdate: center: ${this.props.centeredOrdinal} oldCenter: ${
        prevProps.centeredOrdinal
      } first: ${this.props.messageOrdinals.first()} last: ${this.props.messageOrdinals.last()} oldFirst: ${prevProps.messageOrdinals.first()} oldLast: ${prevProps.messageOrdinals.last()}`
    )
    if (!!this.props.centeredOrdinal && this.props.centeredOrdinal !== prevProps.centeredOrdinal) {
      debug(`componentDidUpdate: attempting scroll`)
      this.scrollToCentered()
    }
  }

  render() {
    return (
      <Kb.ErrorBoundary>
        <Kb.Box style={styles.container}>
          <Kb.NativeVirtualizedList
            contentContainerStyle={styles.contentContainer}
            data={this.props.messageOrdinals}
            inverted={true}
            getItem={this.getItem}
            getItemCount={this.getItemCount}
            renderItem={this.renderItem}
            maintainVisibleContentPosition={this.maintainVisibleContentPosition}
            onViewableItemsChanged={this.onViewableItemsChanged}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            keyExtractor={this.keyExtractor}
            // Limit the number of pages rendered ahead of time (which also limits attachment previews loaded)
            windowSize={5}
            ref={this.listRef}
            onScrollToIndexFailed={this.onScrollToIndexFailed}
            removeClippedSubviews={Styles.isAndroid}
          />
          {!this.props.containsLatestMessage && this.props.messageOrdinals.size > 0 && (
            <JumpToRecent onClick={this.jumpToRecent} style={styles.jumpToRecent} />
          )}
        </Kb.Box>
      </Kb.ErrorBoundary>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
    } as const)
)

export default ConversationList
