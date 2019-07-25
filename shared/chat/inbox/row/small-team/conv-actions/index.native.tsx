import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import {Props} from '.'

const onMute = (onMuteConversation: () => void, ref) => {
  ref.current && ref.current.close()
  onMuteConversation()
}

const onHide = (onHideConversation: () => void, ref) => {
  ref.current && ref.current.close()
  onHideConversation()
}

const renderRightAction = (text, color, icon, x, handler, progress) => {
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

const renderRightActions = (props: Props, ref, progress) => {
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

const ConvActions = (props: Props) => {
  const swiperef = React.useRef<Kb.Swipeable>()
  return (
    <Kb.Swipeable
      ref={swiperef}
      renderRightActions={progress => renderRightActions(props, swiperef, progress)}
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
