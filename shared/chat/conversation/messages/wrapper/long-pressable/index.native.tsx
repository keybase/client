import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {Props} from '.'
import {OrdinalContext} from '../../ids-context'
import Swipeable, {type SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable'
import {dismiss} from '@/util/keyboard'
import {Pressable} from 'react-native'
import {FocusContext} from '@/chat/conversation/normal/context'
import * as Reanimated from 'react-native-reanimated'
// import {useDebugLayout} from '@/util/debug-react'

const ReplyIcon = React.memo(function ({progress}: {progress: Reanimated.SharedValue<number>}) {
  const as = Reanimated.useAnimatedStyle(() => {
    const opacity = Reanimated.interpolate(progress.value, [0, -20], [0, 1], Reanimated.Extrapolation.CLAMP)
    return {opacity}
  })
  return (
    <Reanimated.default.View style={[styles.reply, as]}>
      <Kb.Icon type="iconfont-reply" style={styles.replyIcon} />
    </Reanimated.default.View>
  )
})

const LongPressable = React.memo(function LongPressable(props: Props) {
  const {children, onLongPress, style} = props

  const onPress = React.useCallback(() => dismiss(), [])

  // uncomment to debug measuring issues w/ items
  // const onLayout =
  //   useDebugLayout()
  // React.useCallback(() => {
  //   const {conversationIDKey, ordinal} = getIds()
  //   return global.DEBUGStore.store.getState().chat2.messageMap.get(conversationIDKey)?.get(ordinal)
  // }, [getIds])

  const inner = (
    <Pressable
      style={[styles.pressable, style]}
      onLongPress={onLongPress}
      onPress={onPress}
      // uncomment to debug measuring issues w/ items
      // onLayout={onLayout}
    >
      {children}
    </Pressable>
  )

  const makeAction = React.useCallback(
    (_: unknown, progress: Reanimated.SharedValue<number>) => <ReplyIcon progress={progress} />,
    []
  )

  const toggleThreadSearch = C.useChatContext(s => s.dispatch.toggleThreadSearch)
  const setReplyTo = C.useChatContext(s => s.dispatch.setReplyTo)
  const ordinal = React.useContext(OrdinalContext)
  const {focusInput} = React.useContext(FocusContext)
  const onSwipeLeft = React.useCallback(() => {
    setReplyTo(ordinal)
    toggleThreadSearch(true)
    focusInput()
  }, [setReplyTo, toggleThreadSearch, ordinal, focusInput])

  const swipeRef = React.useRef<SwipeableMethods | null>(null)
  const onSwipeableWillOpen = React.useCallback(
    (dir: 'left' | 'right') => {
      if (dir === 'right') {
        swipeRef.current?.close()
        onSwipeLeft()
      }
    },
    [onSwipeLeft]
  )
  return (
    <Swipeable ref={swipeRef} renderRightActions={makeAction} onSwipeableWillOpen={onSwipeableWillOpen}>
      {inner}
    </Swipeable>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      pressable: {
        flexDirection: 'row',
        paddingBottom: 3,
        paddingRight: Kb.Styles.globalMargins.tiny,
        paddingTop: 3,
      },
      reply: {
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
      },
      replyIcon: {paddingRight: Kb.Styles.globalMargins.small},
      view: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        position: 'relative',
      },
    }) as const
)

export default LongPressable
