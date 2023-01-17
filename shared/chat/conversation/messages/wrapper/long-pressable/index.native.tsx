import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Container from '../../../../../util/container'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../../../../styles'
import type {Props} from '.'
import {GetIdsContext} from '../../ids-context'
import {SwipeTrigger} from '../../../../../common-adapters/swipeable.native'
import {dismiss} from '../../../../../util/keyboard'

const LongPressable = React.memo(function LongPressable(props: Props) {
  const {children, onLongPress} = props
  const onPress = React.useCallback(() => dismiss(), [])
  const getIds = React.useContext(GetIdsContext)

  // uncomment to debug measuring issues w/ items
  // const thrashMapRef = React.useRef(new Map<number, number>())
  // const onLayout = React.useCallback(
  //   (e: any) => {
  //     const height = e.nativeEvent.layout.height
  //     const {conversationIDKey, ordinal} = getIds()
  //     const old = thrashMapRef.current.get(ordinal)
  //     if (old && old !== height) {
  //       console.log('debug thrash of row item', {
  //         height,
  //         old,
  //         ordinal,
  //         type: global.DEBUGStore.store.getState().chat2.messageMap.get(conversationIDKey)?.get(ordinal),
  //       })
  //     }
  //     thrashMapRef.current.set(ordinal, height)
  //   },
  //   [getIds]
  // )

  const inner = (
    <Kb.NativePressable
      style={styles.pressable}
      onLongPress={onLongPress}
      onPress={onPress}
      // uncomment to debug measuring issues w/ items
      // onLayout={onLayout}
    >
      {children}
    </Kb.NativePressable>
  )

  const makeAction = React.useCallback(() => {
    return (
      <Kb.Box2 direction="vertical" style={styles.reply}>
        <Kb.Icon type="iconfont-reply" style={styles.replyIcon} />
      </Kb.Box2>
    )
  }, [])

  const dispatch = Container.useDispatch()
  const onSwipeLeft = React.useCallback(() => {
    const {conversationIDKey, ordinal} = getIds()
    dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey, ordinal}))
  }, [dispatch, getIds])

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
    } as const)
)

export default LongPressable
