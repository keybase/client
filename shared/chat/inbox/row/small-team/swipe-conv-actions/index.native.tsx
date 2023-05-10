import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Container from '../../../../../util/container'
import * as Kb from '../../../../../common-adapters'
import * as React from 'react'
import * as Reanimated from 'react-native-reanimated'
import * as RowSizes from '../../sizes'
import * as Styles from '../../../../../styles'
import type {Props} from '.'
import {RectButton} from 'react-native-gesture-handler'
import {Swipeable} from '../../../../../common-adapters/swipeable.native'
import {ConversationIDKeyContext} from '../contexts'
import {View} from 'react-native'

const actionWidth = 64

const Action = (p: {
  text: string
  mult: number
  color: Styles.Color
  iconType: Kb.IconType
  onClick: () => void
  progress: Reanimated.SharedValue<number>
}) => {
  const {text, color, iconType, onClick, progress, mult} = p
  const as = Reanimated.useAnimatedStyle(() => {
    return {
      transform: [{translateX: mult * -progress.value}],
    }
  })

  return (
    <Reanimated.default.View style={[styles.action, as]}>
      <RectButton style={[styles.rightAction, {backgroundColor: color as string}]} onPress={onClick}>
        <Kb.Icon type={iconType} color={Styles.globalColors.white} />
        <Kb.Text type="BodySmall" style={styles.actionText}>
          {text}
        </Kb.Text>
      </RectButton>
    </Reanimated.default.View>
  )
}

const SwipeConvActions = React.memo(function SwipeConvActions(p: Props) {
  const {swipeCloseRef, children, onClick} = p
  const conversationIDKey = React.useContext(ConversationIDKeyContext)
  const [extraData, setExtraData] = React.useState(0)
  const [lastCID, setLastCID] = React.useState(conversationIDKey)
  if (lastCID !== conversationIDKey) {
    setLastCID(conversationIDKey)
    // only if open
    if (swipeCloseRef?.current) {
      setExtraData(d => d + 1)
    }
  }

  const dispatch = Container.useDispatch()
  const onMarkConversationAsUnread = Container.useEvent(() => {
    dispatch(Chat2Gen.createMarkAsUnread({conversationIDKey, readMsgID: null}))
  })
  const onMuteConversation = Container.useEvent(() => {
    dispatch(Chat2Gen.createMuteConversation({conversationIDKey, muted: !isMuted}))
  })
  const onHideConversation = Container.useEvent(() => {
    dispatch(Chat2Gen.createHideConversation({conversationIDKey}))
  })

  const isMuted = Container.useSelector(state => state.chat2.mutedMap.get(conversationIDKey) ?? false)

  const onMarkAsUnread = Container.useEvent(() => {
    onMarkConversationAsUnread()
    swipeCloseRef?.current?.()
  })

  const onMute = Container.useEvent(() => {
    onMuteConversation()
    swipeCloseRef?.current?.()
  })

  const onHide = Container.useEvent(() => {
    onHideConversation()
    swipeCloseRef?.current?.()
  })

  const makeActionsRef = React.useRef<(p: Reanimated.SharedValue<number>) => React.ReactNode>(
    (_p: Reanimated.SharedValue<number>) => null
  )
  makeActionsRef.current = (progress: Reanimated.SharedValue<number>) => (
    <View style={styles.container}>
      <Action
        text="Unread"
        color={Styles.globalColors.blue}
        iconType="iconfont-envelope-solid"
        onClick={onMarkAsUnread}
        mult={0}
        progress={progress}
      />
      <Action
        text={isMuted ? 'Unmute' : 'Mute'}
        color={Styles.globalColors.orange}
        iconType="iconfont-shh"
        onClick={onMute}
        mult={1 / 3}
        progress={progress}
      />
      <Action
        text="Hide"
        color={Styles.globalColors.greyDarker}
        iconType="iconfont-hide"
        onClick={onHide}
        mult={2 / 3}
        progress={progress}
      />
    </View>
  )

  const props = {
    children,
    extraData,
    makeActionsRef,
    onClick,
    swipeCloseRef,
  }

  return <SwipeConvActionsImpl {...props} />
})

type IProps = {
  children: React.ReactNode
  extraData: unknown
  onClick?: () => void
  swipeCloseRef: Props['swipeCloseRef']
  makeActionsRef: React.MutableRefObject<(p: Reanimated.SharedValue<number>) => React.ReactNode>
}

const SwipeConvActionsImpl = React.memo(function SwipeConvActionsImpl(props: IProps) {
  const {children, swipeCloseRef, makeActionsRef, extraData, onClick} = props
  return (
    <Swipeable
      actionWidth={actionWidth * 3}
      swipeCloseRef={swipeCloseRef}
      makeActionsRef={makeActionsRef}
      style={styles.row}
      extraData={extraData}
      onClick={onClick}
    >
      {children}
    </Swipeable>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      action: {
        height: '100%',
        left: 0,
        position: 'absolute',
        top: 0,
        width: actionWidth,
      },
      actionText: {
        backgroundColor: 'transparent',
        color: Styles.globalColors.white,
      },
      container: {
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        position: 'relative',
        width: '100%',
      },
      rightAction: {
        alignItems: 'center',
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      },
      row: {
        flexShrink: 0,
        height: RowSizes.smallRowHeight,
      },
    } as const)
)

export default SwipeConvActions
