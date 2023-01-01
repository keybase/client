import {SwipeTrigger} from '../../../../../common-adapters/swipeable.native'
import {dismiss} from '../../../../../util/keyboard'
import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import type {Props} from '.'

const LongPressable = React.memo(function LongPressable(props: Props) {
  const {children, onLongPress, style, conversationIDKey, ordinal} = props

  const dispatch = Container.useDispatch()
  const onReply = React.useCallback(() => {
    ordinal && dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey, ordinal}))
  }, [dispatch, conversationIDKey, ordinal])

  const dismissKeyboard = React.useCallback(() => dismiss(), [])

  const onPress = ordinal ? dismissKeyboard : undefined
  const onSwipeLeft = ordinal ? onReply : undefined

  const inner = (
    <Kb.NativePressable key="longPressable" style={style} onLongPress={onLongPress} onPress={onPress}>
      <Kb.NativeView style={styles.view}>{children}</Kb.NativeView>
    </Kb.NativePressable>
  )

  const makeAction = React.useCallback(() => {
    return (
      <Kb.Box2 direction="vertical" style={styles.reply}>
        <Kb.Icon type="iconfont-reply" style={styles.replyIcon} />
      </Kb.Box2>
    )
  }, [])

  // Only swipeable if there is an onSwipeLeft handler.
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
      reply: {
        alignSelf: 'flex-end',
        justifyContent: 'flex-end',
      },
      replyIcon: {paddingRight: Styles.globalMargins.small},
      view: {
        ...Styles.globalStyles.flexBoxColumn,
        position: 'relative',
      },
    } as const)
)

export default LongPressable
