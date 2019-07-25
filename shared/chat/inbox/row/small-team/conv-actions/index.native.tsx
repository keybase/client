import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import {Props} from '.'

const onMute = (onMuteConversation: () => void, ref: React.Ref<Kb.Swipeable>) => {
  ref.current && ref.current.close()
  onMuteConversation()
}

const onHide = (onHideConversation: () => void, ref: React.Ref<Kb.Swipeable>) => {
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
        <Kb.NativeText style={styles.actionText}>{text}</Kb.NativeText>
      </Kb.RectButton>
    </Kb.NativeAnimated.View>
  )
}

const ConvActions = React.forwardRef((props: Props, ref: React.Ref<Kb.Swipeable>) => {
  return (
    <Kb.NativeView style={{width: 128, flexDirection: 'row'}}>
      {renderRightAction(
        props.isMuted ? 'Unmute' : 'Mute',
        Styles.globalColors.orange,
        <Kb.Icon type="iconfont-shh" color={Styles.globalColors.white} />,
        128,
        () => onMute(props.onMuteConversation, ref),
        props.progress
      )}
      {renderRightAction(
        'Hide',
        Styles.globalColors.greyDarker,
        <Kb.Icon type="iconfont-hide" color={Styles.globalColors.white} />,
        64,
        () => onHide(props.onHideConversation, ref),
        props.progress
      )}
    </Kb.NativeView>
  )
})

const styles = Styles.styleSheetCreate({
  actionText: {
    color: Styles.globalColors.white,
    backgroundColor: 'transparent',
  },
  rightAction: {
    alignItems: 'center',
    fontSize: 16,
    flex: 1,
    justifyContent: 'center',
  },
})

export default ConvActions
