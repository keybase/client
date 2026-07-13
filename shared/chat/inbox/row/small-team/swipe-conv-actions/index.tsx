import * as Chat from '@/constants/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import * as RowSizes from '../../sizes'
import {Animated, Pressable, View} from 'react-native'
import type {ConversationIDKey} from '@/constants/types/chat'

type Props = {
  children: React.ReactNode
  conversationIDKey: ConversationIDKey
  onPress?: () => void
}
import Swipeable, {type SwipeableMethods} from '@/common-adapters/swipeable-row'
import {useOpenedRowState} from '../../opened-row-state'
import {useInboxRowIsMuted} from '@/chat/inbox/rows-state'
import {hideConversation, markConversationUnread, muteConversation} from '@/chat/conversation/status-actions'

const actionWidth = 64

const Action = (p: {
  text: string
  offset: number
  color: Kb.Styles.Color
  iconType: Kb.IconType
  onClick: () => void
  progress: Animated.AnimatedDivision<number>
}) => {
  'use no memo'
  const {text, color, iconType, onClick, progress, offset} = p
  const translateX = progress.interpolate({
    extrapolate: 'clamp',
    inputRange: [0, 1],
    outputRange: [actionWidth, (2 - offset) * -actionWidth],
  })

  return (
    <Animated.View style={[nativeStyles.action, {transform: [{translateX}]}]}>
      <Pressable style={[nativeStyles.rightAction, {backgroundColor: color as string}]} onPress={onClick}>
        <Kb.Icon type={iconType} color={Kb.Styles.globalColors.white} />
        <Kb.Text type="BodySmall" style={nativeStyles.actionText}>
          {text}
        </Kb.Text>
      </Pressable>
    </Animated.View>
  )
}

function SwipeConvActions(p: Props) {
  const {conversationIDKey} = p
  const isOpened = useOpenedRowState(s => s.openedRow === conversationIDKey)
  const wasOpenRef = React.useRef(isOpened)
  const setOpenedRow = useOpenedRowState(s => s.dispatch.setOpenRow)
  const swipeableRef = React.useRef<SwipeableMethods | null>(null)
  const isMuted = useInboxRowIsMuted(conversationIDKey)

  React.useLayoutEffect(() => {
    swipeableRef.current?.reset()
    wasOpenRef.current = false
  }, [conversationIDKey])

  React.useEffect(() => {
    if (!isOpened && wasOpenRef.current) {
      swipeableRef.current?.close()
    }
  }, [isOpened])

  React.useEffect(() => {
    wasOpenRef.current = isOpened
  }, [isOpened])

  if (!isMobile) {
    return <div style={Kb.Styles.castStyleDesktop(desktopStyles.row)}>{p.children}</div>
  }

  const {children, onPress} = p

  const closeOpenedRow = () => {
    if (isOpened) {
      setOpenedRow(Chat.noConversationIDKey)
    }
  }

  const onMarkAsUnread = () => {
    markConversationUnread(conversationIDKey)
    closeOpenedRow()
  }

  const onMute = () => {
    muteConversation(conversationIDKey, !isMuted)
    closeOpenedRow()
  }

  const onHide = () => {
    hideConversation(conversationIDKey, true)
    closeOpenedRow()
  }

  const onSwipeableOpenStartDrag = () => {
    setOpenedRow(conversationIDKey)
  }

  const renderRightActions = (progress: Animated.AnimatedDivision<number>) => {
    return (
      <View style={[nativeStyles.container, {width: 3 * actionWidth}]}>
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
    <Pressable onPress={onPress} style={nativeStyles.touchable} testID={TestIDs.CHAT_INBOX_ROW}>
      <View accessible={false} style={nativeStyles.touchable}>
        {children}
      </View>
    </Pressable>
  ) : (
    <View style={nativeStyles.touchable} testID={TestIDs.CHAT_INBOX_ROW}>
      {children}
    </View>
  )

  return (
    <Swipeable
      ref={swipeableRef}
      onSwipeableOpenStartDrag={onSwipeableOpenStartDrag}
      renderRightActions={renderRightActions}
      containerStyle={nativeStyles.row}
    >
      {inner}
    </Swipeable>
  )
}

const desktopStyles = Kb.Styles.styleSheetCreate(() => ({
  row: {
    flexShrink: 0,
    height: RowSizes.smallRowHeight,
    width: '100%',
  },
}))

const nativeStyles = Kb.Styles.styleSheetCreate(
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
        ...Kb.Styles.centered(),
        height: '100%',
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
