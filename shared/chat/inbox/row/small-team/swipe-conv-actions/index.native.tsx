import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import type {Props} from '.'

let openSwipeRef: React.RefObject<Kb.Swipeable> | undefined

const Action = (p: {
  text: string
  color: Styles.Color
  iconType: Kb.IconType
  x: number
  onClick: () => void
  progress: Kb.NativeAnimated.AnimatedInterpolation
}) => {
  const {text, color, iconType, x, onClick, progress} = p
  const trans = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [x, 0],
  })
  return (
    <Kb.NativeAnimated.View style={{flex: 1, transform: [{translateX: trans}]}}>
      <Kb.RectButton style={[styles.rightAction, {backgroundColor: color as string}]} onPress={onClick}>
        <Kb.Icon type={iconType} color={Styles.globalColors.white} />
        <Kb.Text type="BodySmall" style={styles.actionText}>
          {text}
        </Kb.Text>
      </Kb.RectButton>
    </Kb.NativeAnimated.View>
  )
}

const SwipeConvActions = (props: Props) => {
  const swipeRef = React.useRef<Kb.Swipeable>(null)
  const {children, isMuted, onMuteConversation, onHideConversation} = props

  const onCleanRef = React.useCallback(() => {
    // we're unmounting, so lets not hold the ref
    if (swipeRef === openSwipeRef) {
      openSwipeRef = undefined
    }
  }, [swipeRef])

  const onClose = React.useCallback(() => {
    swipeRef.current?.close()
    onCleanRef()
  }, [swipeRef, onCleanRef])

  const onMute = React.useCallback(() => {
    onMuteConversation()
    onClose()
  }, [onClose, onMuteConversation])

  const onHide = React.useCallback(() => {
    onHideConversation()
    onClose()
  }, [onClose, onHideConversation])

  const onWillOpen = React.useCallback(() => {
    // close others
    openSwipeRef?.current?.close()
    openSwipeRef = swipeRef
  }, [swipeRef])

  React.useEffect(() => {
    return () => {
      onCleanRef()
    }
    // eslint-disable-next-line
  }, []) // only run on unmount

  const renderRightActions = React.useCallback(
    (progress: Kb.NativeAnimated.AnimatedInterpolation) => (
      <Kb.NativeView style={styles.container}>
        <Action
          text={isMuted ? 'Unmute' : 'Mute'}
          color={Styles.globalColors.orange}
          iconType="iconfont-shh"
          x={128}
          onClick={onMute}
          progress={progress}
        />
        <Action
          text="Hide"
          color={Styles.globalColors.greyDarker}
          iconType="iconfont-hide"
          x={64}
          onClick={onHide}
          progress={progress}
        />
      </Kb.NativeView>
    ),
    [isMuted, onHide, onMute]
  )

  return (
    <Kb.Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={onWillOpen}
      friction={2}
      leftThreshold={30}
      rightThreshold={40}
    >
      {children}
    </Kb.Swipeable>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionText: {
        backgroundColor: 'transparent',
        color: Styles.globalColors.white,
      },
      container: {
        flexDirection: 'row',
        width: 128,
      },
      rightAction: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        width: 65, // set to one pixel larger to stop a visual blinking artifact
      },
    } as const)
)

export default SwipeConvActions
