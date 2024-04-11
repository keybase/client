import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {Props} from '.'
import {OrdinalContext} from '../../ids-context'
import {SwipeTrigger} from '@/common-adapters/swipeable.native'
import {dismiss} from '@/util/keyboard'
import {Pressable} from 'react-native'
import {FocusContext} from '@/chat/conversation/normal/context'
// import {useDebugLayout} from '@/util/debug-react'

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

  const makeAction = React.useCallback(() => {
    return (
      <Kb.Box2 direction="vertical" style={styles.reply}>
        <Kb.Icon type="iconfont-reply" style={styles.replyIcon} />
      </Kb.Box2>
    )
  }, [])

  const toggleThreadSearch = C.useChatContext(s => s.dispatch.toggleThreadSearch)
  const setReplyTo = C.useChatContext(s => s.dispatch.setReplyTo)
  const ordinal = React.useContext(OrdinalContext)
  const {focusInput} = React.useContext(FocusContext)
  const onSwipeLeft = React.useCallback(() => {
    setReplyTo(ordinal)
    toggleThreadSearch(true)
    focusInput()
  }, [setReplyTo, toggleThreadSearch, ordinal, focusInput])

  // Only swipeable if there is an onSwipeLeft handler
  return (
    <SwipeTrigger actionWidth={100} onSwiped={onSwipeLeft} makeAction={makeAction}>
      {inner}
    </SwipeTrigger>
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
