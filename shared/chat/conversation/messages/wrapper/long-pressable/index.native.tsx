import * as C from '../../../../../constants'
import * as Kb from '../../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../../styles'
import type {Props} from '.'
import {GetIdsContext} from '../../ids-context'
import {SwipeTrigger} from '../../../../../common-adapters/swipeable.native'
import {dismiss} from '../../../../../util/keyboard'
import {Pressable} from 'react-native'
// import {useDebugLayout} from '../../../../../util/debug'

const LongPressable = React.memo(function LongPressable(props: Props) {
  const {children, onLongPress, style} = props
  const onPress = React.useCallback(() => dismiss(), [])
  const getIds = React.useContext(GetIdsContext)

  // uncomment to debug measuring issues w/ items
  const onLayout = undefined /*useDebugLayout(
    React.useCallback(() => {
      const {conversationIDKey, ordinal} = getIds()
      return global.DEBUGStore.store.getState().chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    }, [getIds])
  )*/

  const inner = (
    <Pressable
      style={[styles.pressable, style]}
      onLongPress={onLongPress}
      onPress={onPress}
      // uncomment to debug measuring issues w/ items
      onLayout={onLayout}
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
  const onSwipeLeft = React.useCallback(() => {
    const {ordinal} = getIds()
    setReplyTo(ordinal)
    toggleThreadSearch(true)
  }, [setReplyTo, toggleThreadSearch, getIds])

  // Only swipeable if there is an onSwipeLeft handler
  if (onSwipeLeft) {
    return (
      <SwipeTrigger actionWidth={100} onSwiped={onSwipeLeft} makeAction={makeAction}>
        {inner}
      </SwipeTrigger>
    )
  } else {
    return inner
  }
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      pressable: {
        flexDirection: 'row',
        paddingBottom: 3,
        paddingRight: Styles.globalMargins.tiny,
        paddingTop: 3,
      },
      reply: {
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
      },
      replyIcon: {paddingRight: Styles.globalMargins.small},
      view: {
        ...Styles.globalStyles.flexBoxColumn,
        position: 'relative',
      },
    }) as const
)

export default LongPressable
