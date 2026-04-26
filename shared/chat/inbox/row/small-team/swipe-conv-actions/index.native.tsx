import * as Chat from '@/constants/chat'
import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Reanimated from 'react-native-reanimated'
import * as RowSizes from '../../sizes'
import type {Props} from '.'
import {View} from 'react-native'
import {RectButton} from 'react-native-gesture-handler'
import Swipeable, {type SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable'
import {useOpenedRowState} from '../../opened-row-state'
import {useInboxRowSmall} from '@/stores/inbox-rows'

const actionWidth = 64

const Action = (p: {
  text: string
  offset: number
  color: Kb.Styles.Color
  iconType: Kb.IconType
  onClick: () => void
  progress: Reanimated.SharedValue<number>
}) => {
  'use no memo'
  const {text, color, iconType, onClick, progress, offset} = p
  const as = Reanimated.useAnimatedStyle(() => {
    const ratio = progress.value
    const translateX = Reanimated.interpolate(
      ratio,
      [0, 1],
      [actionWidth, (2 - offset) * -actionWidth],
      Reanimated.Extrapolation.CLAMP
    )
    return {
      transform: [{translateX}],
    }
  })

  return (
    <Reanimated.default.View style={[styles.action, as]}>
      <RectButton style={[styles.rightAction, {backgroundColor: color as string}]} onPress={onClick}>
        <Kb.Icon type={iconType} color={Kb.Styles.globalColors.white} />
        <Kb.Text type="BodySmall" style={styles.actionText}>
          {text}
        </Kb.Text>
      </RectButton>
    </Reanimated.default.View>
  )
}

function SwipeConvActions(p: Props) {
  const {conversationIDKey} = p
  const isOpened = useOpenedRowState(s => s.openedRow === conversationIDKey)
  const wasOpenRef = React.useRef(isOpened)
  const setOpenedRow = useOpenedRowState(s => s.dispatch.setOpenRow)
  const swipeableRef = React.useRef<SwipeableMethods | null>(null)
  const closeOpenedRow = () => {
    if (isOpened) {
      setOpenedRow(Chat.noConversationIDKey)
    }
  }
  const {children, onPress} = p

  const isMuted = useInboxRowSmall(conversationIDKey).isMuted
  const cs = ConvoState.getConvoState(conversationIDKey)
  const setMarkAsUnread = cs.dispatch.setMarkAsUnread
  const mute = cs.dispatch.mute
  const hideConversation = cs.dispatch.hideConversation

  const onMarkAsUnread = () => {
    setMarkAsUnread()
    closeOpenedRow()
  }

  const onMute = () => {
    mute(!isMuted)
    closeOpenedRow()
  }

  const onHide = () => {
    hideConversation(true)
    closeOpenedRow()
  }

  const onSwipeableOpenStartDrag = () => {
    setOpenedRow(conversationIDKey)
  }

  React.useEffect(() => {
    if (!isOpened && wasOpenRef.current) {
      swipeableRef.current?.close()
    }
  }, [isOpened])

  React.useEffect(() => {
    wasOpenRef.current = isOpened
  }, [isOpened])

  const renderRightActions = (progress: Reanimated.SharedValue<number>) => {
    return (
      <View style={[styles.container, {width: 3 * actionWidth}]}>
        <Action
          text="Unread"
          color={Kb.Styles.globalColors.blue}
          iconType="iconfont-envelope-solid"
          onClick={onMarkAsUnread}
          offset={0}
          progress={progress}
        />
        <Action
          text={isMuted ? 'Unmute' : 'Mute'}
          color={Kb.Styles.globalColors.orange}
          iconType="iconfont-shh"
          onClick={onMute}
          offset={1}
          progress={progress}
        />
        <Action
          text="Hide"
          color={Kb.Styles.globalColors.greyDarker}
          iconType="iconfont-hide"
          onClick={onHide}
          offset={2}
          progress={progress}
        />
      </View>
    )
  }

  const inner = onPress ? (
    <RectButton onPress={onPress} style={styles.touchable} testID="inboxRow">
      <View accessible={false} style={styles.touchable}>
        {children}
      </View>
    </RectButton>
  ) : (
    <View style={styles.touchable} testID="inboxRow">
      {children}
    </View>
  )

  return (
    <Swipeable
      ref={swipeableRef}
      onSwipeableOpenStartDrag={onSwipeableOpenStartDrag}
      renderRightActions={renderRightActions}
      containerStyle={styles.row}
    >
      {inner}
    </Swipeable>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      action: {
        height: '100%',
        position: 'absolute',
        right: 0,
        top: 0,
        width: actionWidth,
      },
      actionText: {
        backgroundColor: 'transparent',
        color: Kb.Styles.globalColors.white,
      },
      container: {
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
      },
      rightAction: {
        alignItems: 'center',
        height: '100%',
        justifyContent: 'center',
      },
      row: {
        flexShrink: 0,
        height: RowSizes.smallRowHeight,
      },
      touchable: {
        height: RowSizes.smallRowHeight,
        width: '100%',
      },
    }) as const
)

export default SwipeConvActions
