import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import {Swipeable2} from '../../../../../common-adapters/swipeable.native'
import * as Styles from '../../../../../styles'
import {RectButton} from 'react-native-gesture-handler'
import * as Reanimated from 'react-native-reanimated'
import type {Props} from '.'

const Action = (p: {
  text: string
  mult: number
  color: Styles.Color
  iconType: Kb.IconType
  onClick: () => void
  progress: Reanimated.SharedValue<number>
}) => {
  const {text, color, iconType, onClick, progress, mult} = p
  const as = Reanimated.useAnimatedStyle(() => ({
    transform: [{translateX: -mult * progress.value}],
  }))

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

const SwipeConvActions = (props: Props) => {
  const {children, isMuted, onMuteConversation, onHideConversation, swipeCloseRef} = props

  const onMute = React.useCallback(() => {
    onMuteConversation()
    swipeCloseRef?.current?.()
  }, [swipeCloseRef, onMuteConversation])

  const onHide = React.useCallback(() => {
    onHideConversation()
    swipeCloseRef?.current?.()
  }, [swipeCloseRef, onHideConversation])

  const makeActions = React.useCallback(
    (progress: Reanimated.SharedValue<number>) => (
      <Kb.NativeView style={styles.container}>
        <Action
          text={isMuted ? 'Unmute' : 'Mute'}
          color={Styles.globalColors.orange}
          iconType="iconfont-shh"
          onClick={onMute}
          mult={0}
          progress={progress}
        />
        <Action
          text="Hide"
          color={Styles.globalColors.greyDarker}
          iconType="iconfont-hide"
          onClick={onHide}
          mult={0.5}
          progress={progress}
        />
      </Kb.NativeView>
    ),
    [isMuted, onHide, onMute]
  )

  return (
    <Swipeable2 actionWidth={128} swipeCloseRef={swipeCloseRef} makeActions={makeActions}>
      {children}
    </Swipeable2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      action: {
        height: '100%',
        left: 0,
        position: 'absolute',
        top: 0,
        width: 64,
      },
      actionText: {
        backgroundColor: 'transparent',
        color: Styles.globalColors.white,
      },
      container: {
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        width: 128,
      },
      rightAction: {
        alignItems: 'center',
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      },
    } as const)
)

export default SwipeConvActions
