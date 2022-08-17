import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/chat2'
import JumpToRecent from './jump-to-recent'
import Message from '../messages'
import SpecialBottomMessage from '../messages/special-bottom-message'
import SpecialTopMessage from '../messages/special-top-message'
import logger from '../../../logger'
import {Animated, type ListRenderItemInfo} from 'react-native'
import type {Props, ItemType} from '.'
import {mobileTypingContainerHeight} from '../input-area/normal/typing'
import * as Hooks from './hooks'

const targetHitArea = 1

// Bookkeep whats animating so it finishes and isn't replaced, if we've animated it we keep the key and use null
const animatingMap = new Map<string, null | React.ReactElement>()

type AnimatedChildProps = {
  animatingKey: string
  children: React.ReactNode
}
const AnimatedChild = React.memo(({children, animatingKey}: AnimatedChildProps) => {
  const translateY = new Animated.Value(999)
  const opacity = new Animated.Value(0)
  React.useEffect(() => {
    // on unmount, mark it null
    return () => {
      animatingMap.set(animatingKey, null)
    }
  }, [animatingKey])
  return (
    <Animated.View
      style={{opacity, overflow: 'hidden', transform: [{translateY}], width: '100%'}}
      onLayout={(e: any) => {
        const {height} = e.nativeEvent.layout
        translateY.setValue(height + 10)
        Animated.parallel([
          Animated.timing(opacity, {
            duration: 200,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            duration: 200,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start(() => {
          animatingMap.set(animatingKey, null)
        })
      }}
    >
      {children}
    </Animated.View>
  )
})

type SentProps = {
  children?: React.ReactElement
  conversationIDKey: Types.ConversationIDKey
  ordinal: Types.Ordinal
  prevOrdinal: Types.Ordinal | undefined
}
const Sent_ = ({conversationIDKey, ordinal, prevOrdinal}: SentProps) => {
  const you = Container.useSelector(state => state.config.username)
  const message = Container.useSelector(state => state.chat2.messageMap.get(conversationIDKey)?.get(ordinal))
  const youSent = message && message.author === you && message.ordinal !== message.id
  const key = `${conversationIDKey}:${ordinal}`
  const state = animatingMap.get(key)

  // if its animating always show it
  if (state) {
    return state
  }

  const children = (
    <Message key={ordinal} ordinal={ordinal} previous={prevOrdinal} conversationIDKey={conversationIDKey} />
  )

  // if state is null we already animated it
  if (youSent && state === undefined) {
    const c = <AnimatedChild animatingKey={key}>{children}</AnimatedChild>
    animatingMap.set(key, c)
    return c
  } else {
    return children || null
  }
}
const Sent = React.memo(Sent_)

// We load the first thread automatically so in order to mark it read
// we send an action on the first mount once
let markedInitiallyLoaded = false

export const DEBUGDump = () => {}

// TODO del
type OLDPROPS = {
  centeredOrdinal?: Types.Ordinal
  containsLatestMessage: boolean
  conversationIDKey: Types.ConversationIDKey
  copyToClipboard: (arg0: string) => void
  editingOrdinal?: Types.Ordinal
  lastMessageIsOurs: boolean
  loadNewerMessages: (ordinal?: Types.Ordinal | null) => void
  loadOlderMessages: (ordinal?: Types.Ordinal | null) => void
  markInitiallyLoadedThreadAsRead: () => void
  messageOrdinals: Array<Types.Ordinal>
  onFocusInput: () => void
  onJumpToRecent: () => void
  scrollListDownCounter: number
  scrollListToBottomCounter: number
  scrollListUpCounter: number
  listRef: React.MutableRefObject<Kb.NativeVirtualizedList<ItemType> | null>
}

const ConversationList = (p: OLDPROPS) => {
  const {conversationIDKey, onFocusInput} = p
  const {scrollListDownCounter, scrollListToBottomCounter, scrollListUpCounter} = p

  const isMountedRef = Hooks.useIsMounted()

  const listRef = React.useRef<Kb.NativeVirtualizedList<ItemType> | null>(null)

  const {markInitiallyLoadedThreadAsRead} = Hooks.useActions({conversationIDKey})

  const oldProps = {
    ...p,
    conversationIDKey,
    isMountedRef,
    listRef,
    onFocusInput,
    scrollListDownCounter,
    scrollListToBottomCounter,
    scrollListUpCounter,
  }

  React.useEffect(() => {
    if (!markedInitiallyLoaded) {
      markedInitiallyLoaded = true
      markInitiallyLoadedThreadAsRead()
    }
    // if (centeredOrdinal) {
    //   lockedToBottomRef.current = false
    //   scrollToCentered()
    //   return
    // }
    // if (isLockedToBottom()) {
    //   scrollToBottom()
    // }
    // we only want this to happen once per mount
    // eslint-disable-next-line
  }, [])

  return <OldConversationList {...oldProps} />
}

// TODO del
class OldConversationList extends React.PureComponent<OLDPROPS> {
  componentDidMount() {
    if (markedInitiallyLoaded) {
      return
    }
    markedInitiallyLoaded = true
    this.props.markInitiallyLoadedThreadAsRead()
  }

  private scrollCenterTarget?: number

  private renderItem = (i: ListRenderItemInfo<ItemType>) => {
    const {item} = i
    if (item === 'specialTop') {
      return <SpecialTopMessage conversationIDKey={this.props.conversationIDKey} />
    } else if (item === 'specialBottom') {
      return <SpecialBottomMessage conversationIDKey={this.props.conversationIDKey} />
    } else {
      const ordinalIndex = item
      const ordinal = this.props.messageOrdinals[ordinalIndex]
      const prevOrdinal = ordinalIndex > 0 ? this.props.messageOrdinals[ordinalIndex - 1] : undefined

      if (!ordinal) {
        return null
      }

      if (this.props.messageOrdinals.length - 1 === ordinalIndex) {
        return (
          <Sent
            key={ordinal}
            ordinal={ordinal}
            prevOrdinal={prevOrdinal}
            conversationIDKey={this.props.conversationIDKey}
          />
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

  private getItem = (messageOrdinals: Array<Types.Ordinal>, index: number) => {
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

  private getIndexFromItem = (item: number) => this.getItemCount(this.props.messageOrdinals) - item - 2

  private getOrdinalIndex = (target: Types.Ordinal) => {
    for (let item = 0; item < this.props.messageOrdinals.length; item++) {
      const ordinal = this.props.messageOrdinals[item] || 0
      if (ordinal === target) {
        return this.getIndexFromItem(item)
      }
    }
    return -1
  }

  // the component can pass null here sometimes
  private getItemCount = (messageOrdinals: Array<Types.Ordinal> | null) => {
    if (this.props.isMountedRef.current) {
      return (messageOrdinals?.length ?? 0) + 2
    } else {
      // needed else VirtualizedList will yellowbox
      return 0
    }
  }

  private keyExtractor = (item: ItemType) => {
    if (item === 'specialTop') {
      return 'specialTop'
    }
    if (item === 'specialBottom') {
      return 'specialBottom'
    }
    return String(this.props.messageOrdinals[item])
  }

  // Was using onEndReached but that was really flakey
  private onViewableItemsChanged = ({viewableItems}: {viewableItems: Array<{item: ItemType}>}) => {
    const topRecord = viewableItems[viewableItems.length - 1]
    const bottomRecord = viewableItems[0]
    // we scroll back in time if the specialTop item is the last viewable, *unless* we are currently
    // attempting to scroll to a centered ordinal
    if (!this.scrollCenterTarget && topRecord && topRecord.item === 'specialTop') {
      const ordinalRecord = viewableItems[viewableItems.length - 2]
      // ignore if we don't have real messages
      if (ordinalRecord && ordinalRecord.item !== 'specialBottom' && ordinalRecord.item !== 'specialTop') {
        this.props.loadOlderMessages(this.props.messageOrdinals[ordinalRecord.item])
      }
    }
    if (!topRecord || !bottomRecord) {
      return
    }

    const bottomIndex =
      typeof bottomRecord.item === 'number'
        ? this.getIndexFromItem(bottomRecord.item)
        : this.props.messageOrdinals.length - 1
    const upperIndex = typeof topRecord.item === 'number' ? this.getIndexFromItem(topRecord.item) : 0
    const middleIndex = bottomIndex + Math.floor((upperIndex - bottomIndex) / 2)
    if (!this.scrollCenterTarget) {
      return
    }

    if (
      !(
        this.scrollCenterTarget <= middleIndex + targetHitArea &&
        this.scrollCenterTarget >= middleIndex - targetHitArea
      )
    ) {
      this.scrollToCentered()
    } else {
      this.scrollCenterTarget = undefined
    }
  }

  // not highly documented. keeps new content from shifting around the list if you're scrolled up
  private maintainVisibleContentPosition = {
    minIndexForVisible: 0,
  }

  private jumpToRecent = () => {
    const list = this.props.listRef.current
    if (list) {
      const index = this.getOrdinalIndex(this.props.messageOrdinals[this.props.messageOrdinals.length - 1])
      if (index >= 0) {
        list.scrollToIndex({index})
      }
    }
    this.props.onJumpToRecent()
  }

  private scrollToCentered = () => {
    const list = this.props.listRef.current
    if (!list) {
      return
    }
    const _index =
      this.props.centeredOrdinal === undefined ? -1 : this.getOrdinalIndex(this.props.centeredOrdinal)
    if (_index >= 0) {
      const index = _index + 1 // include the top item
      this.scrollCenterTarget = index
      list.scrollToIndex({
        animated: false,
        index,
        viewPosition: 0.5,
      })
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
    const list = this.props.listRef.current
    if (list) {
      list.scrollToIndex({animated: false, index: info.highestMeasuredFrameIndex})
    }
  }

  componentDidUpdate(prevProps: Props) {
    // if the ordinals are the same but something changed, attempt to scroll to centered
    if (!!this.props.centeredOrdinal && this.props.centeredOrdinal !== prevProps.centeredOrdinal) {
      this.scrollToCentered()
    }
  }

  render() {
    return (
      <Kb.ErrorBoundary>
        <Kb.Box style={styles.container}>
          <Kb.NativeVirtualizedList
            overScrollMode="never"
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
            ref={this.props.listRef}
            onScrollToIndexFailed={this.onScrollToIndexFailed}
            removeClippedSubviews={Styles.isAndroid}
          />
          {!this.props.containsLatestMessage && this.props.messageOrdinals.length > 0 && (
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
      contentContainer: {bottom: -mobileTypingContainerHeight},
      jumpToRecent: {
        bottom: 0,
        position: 'absolute',
      },
    } as const)
)

export default ConversationList
