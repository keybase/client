import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Reanimated from 'react-native-reanimated'
import * as RowSizes from '../../sizes'
import type {Props} from '.'
import {RectButton} from 'react-native-gesture-handler'
import Swipeable, {type SwipeableMethods} from 'react-native-gesture-handler/ReanimatedSwipeable'
import {View} from 'react-native'

const actionWidth = 64

const Action = (p: {
  text: string
  offset: number
  color: Kb.Styles.Color
  iconType: Kb.IconType
  onClick: () => void
  progress: Reanimated.SharedValue<number>
}) => {
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

const SwipeConvActions = React.memo(function SwipeConvActions(p: Props) {
  const {children, setCloseOpenedRow, closeOpenedRow} = p
  const conversationIDKey = C.useChatContext(s => s.id)
  const lastCIDRef = React.useRef(conversationIDKey)
  React.useEffect(() => {
    if (lastCIDRef.current !== conversationIDKey) {
      lastCIDRef.current = conversationIDKey
      closeOpenedRow()
    }
  }, [conversationIDKey, closeOpenedRow])

  const setMarkAsUnread = C.useChatContext(s => s.dispatch.setMarkAsUnread)
  const onMarkConversationAsUnread = C.useEvent(() => {
    setMarkAsUnread()
  })

  const mute = C.useChatContext(s => s.dispatch.mute)
  const onMuteConversation = C.useEvent(() => {
    mute(!isMuted)
  })

  const hideConversation = C.useChatContext(s => s.dispatch.hideConversation)
  const onHideConversation = C.useEvent(() => {
    hideConversation(true)
  })

  const isMuted = C.useChatContext(s => s.meta.isMuted)

  const onMarkAsUnread = C.useEvent(() => {
    onMarkConversationAsUnread()
    closeOpenedRow()
  })

  const onMute = C.useEvent(() => {
    onMuteConversation()
    closeOpenedRow()
  })

  const onHide = C.useEvent(() => {
    onHideConversation()
    closeOpenedRow()
  })

  const swipeableRef = React.useRef<SwipeableMethods | null>(null)
  const onSwipeableWillOpen = React.useCallback(() => {
    closeOpenedRow()
    setCloseOpenedRow(() => {
      swipeableRef.current?.close()
    })
  }, [closeOpenedRow, setCloseOpenedRow])

  return (
    <Swipeable
      ref={swipeableRef}
      onSwipeableWillOpen={onSwipeableWillOpen}
      renderRightActions={progress => {
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
      }}
    >
      {children}
    </Swipeable>
  )
})

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
    }) as const
)

export default SwipeConvActions
