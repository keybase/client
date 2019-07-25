import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import {Props} from '.'

let curSwipeRef: React.MutableRefObject<Kb.Swipeable> | null = null

const onMute = (onMuteConversation: () => void, ref: React.MutableRefObject<Kb.Swipeable>) => {
  ref.current && ref.current.close()
  curSwipeRef = null
  onMuteConversation()
}

const onHide = (onHideConversation: () => void, ref: React.MutableRefObject<Kb.Swipeable>) => {
  ref.current && ref.current.close()
  curSwipeRef = null
  onHideConversation()
}

const renderRightAction = (
  text: string,
  color: Styles.Color,
  icon: React.ReactNode,
  x: number,
  handler: () => void,
  progress: Kb.NativeAnimated.Interpolation
) => {
  const trans = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [x, 0],
  })
  return (
    <Kb.NativeAnimated.View style={{flex: 1, transform: [{translateX: trans}]}}>
      <Kb.RectButton style={[styles.rightAction, {backgroundColor: color}]} onPress={handler}>
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
  ref: React.MutableRefObject<Kb.Swipeable>,
  progress: Kb.NativeAnimated.Interpolation
) => {
  return (
    <Kb.NativeView style={{flexDirection: 'row', width: 128}}>
      {renderRightAction(
        props.isMuted ? 'Unmute' : 'Mute',
        Styles.globalColors.orange,
        <Kb.Icon type="iconfont-shh" color={Styles.globalColors.white} />,
        128,
        () => onMute(props.onMuteConversation, ref),
        progress
      )}
      {renderRightAction(
        'Hide',
        Styles.globalColors.greyDarker,
        <Kb.Icon type="iconfont-hide" color={Styles.globalColors.white} />,
        64,
        () => onHide(props.onHideConversation, ref),
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

const ConvActions = (props: Props) => {
  const swiperef = React.useRef<Kb.Swipeable>()
  return (
    <Kb.Swipeable
      ref={swiperef}
      renderRightActions={(progress: Kb.NativeAnimated.Interpolation) =>
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
  rightAction: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
})

export default ConvActions
