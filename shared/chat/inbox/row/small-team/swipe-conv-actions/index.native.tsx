import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import {Props} from '.'

let curSwipeRef: React.RefObject<Kb.Swipeable> | null = null

const onPress = (onPressAction: () => void, ref: React.RefObject<Kb.Swipeable>) => {
  ref.current && ref.current.close()
  curSwipeRef = null
  onPressAction()
}

const renderRightAction = (
  text: string,
  color: Styles.Color,
  icon: React.ReactNode,
  x: number,
  handler: () => void,
  progress: Kb.NativeAnimated.AnimatedInterpolation
) => {
  const trans = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [x, 0],
  })
  return (
    <Kb.NativeAnimated.View style={{flex: 1, transform: [{translateX: trans}]}}>
      <Kb.RectButton
        // @ts-ignore TODO fix styles
        style={[styles.rightAction, {backgroundColor: color}]}
        onPress={handler}
      >
        {icon}
        <Kb.Text type="BodySmall" style={styles.actionText}>
          {text}
        </Kb.Text>
      </Kb.RectButton>
    </Kb.NativeAnimated.View>
  )
}

const renderRightActions = (
  props: Props,
  ref: React.RefObject<Kb.Swipeable>,
  progress: Kb.NativeAnimated.AnimatedInterpolation
) => {
  return (
    <Kb.NativeView style={styles.container}>
      {renderRightAction(
        props.isMuted ? 'Unmute' : 'Mute',
        Styles.globalColors.orange,
        <Kb.Icon type="iconfont-shh" color={Styles.globalColors.white} />,
        128,
        () => onPress(props.onMuteConversation, ref),
        progress
      )}
      {renderRightAction(
        'Hide',
        Styles.globalColors.greyDarker,
        <Kb.Icon type="iconfont-hide" color={Styles.globalColors.white} />,
        64,
        () => onPress(props.onHideConversation, ref),
        progress
      )}
    </Kb.NativeView>
  )
}

const onOpen = ref => {
  if (curSwipeRef && curSwipeRef.current && curSwipeRef !== ref) {
    curSwipeRef.current.close()
  }
  curSwipeRef = ref
}

const SwipeConvActions = (props: Props) => {
  const swiperef = React.useRef<Kb.Swipeable>(null)
  return (
    <Kb.Swipeable
      ref={swiperef}
      renderRightActions={(progress: Kb.NativeAnimated.AnimatedInterpolation) =>
        renderRightActions(props, swiperef, progress)
      }
      onSwipeableWillOpen={() => onOpen(swiperef)}
      friction={2}
      leftThreshold={30}
      rightThreshold={40}
    >
      {props.children}
    </Kb.Swipeable>
  )
}

const styles = Styles.styleSheetCreate({
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
})

export default SwipeConvActions
