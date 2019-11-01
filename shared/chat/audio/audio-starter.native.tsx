import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Types from '../../constants/types/chat2'
import * as Styles from '../../styles'
import flags from '../../util/feature-flags'

type AudioStarterProps = {
  dragY: Kb.NativeAnimated.Value
  locked: boolean
  recording: boolean
  iconStyle?: Styles.StylesCrossPlatform
  lockRecording: () => void
  enableRecording: () => void
  stopRecording: (st: Types.AudioStopType) => void
}

const maxCancelDrift = -20
const maxLockDrift = -70

type TooltipProps = {
  visible: boolean
}

const Tooltip = (props: TooltipProps) => {
  return (
    <Kb.Animated from={{}} to={{opacity: props.visible ? 1 : 0}}>
      {animatedStyle => (
        <Kb.FloatingBox>
          <Kb.Box2
            direction="horizontal"
            style={Styles.collapseStyles([styles.tooltipContainer, animatedStyle])}
          >
            <Kb.Text type="BodySmall" style={{color: Styles.globalColors.white}}>
              Hold the button to record audio.
            </Kb.Text>
          </Kb.Box2>
        </Kb.FloatingBox>
      )}
    </Kb.Animated>
  )
}

const AudioStarter = (props: AudioStarterProps) => {
  let longPressTimer
  const locked = React.useRef<boolean>(false)
  const tapLive = React.useRef<boolean>(false)
  const [showToolTip, setShowToolTip] = React.useState(false)
  const showToolTopFalseLater = Kb.useTimeout(() => {
    setShowToolTip(false)
  }, 3000)
  React.useEffect(() => {
    if (locked.current && !props.locked) {
      locked.current = false
    }
  }, [props.locked])
  if (!flags.audioAttachments) {
    return null
  }
  const animateDown = () => {
    Kb.NativeAnimated.timing(props.dragY, {
      duration: 400,
      easing: Kb.NativeEasing.elastic(1),
      toValue: 0,
      useNativeDriver: true,
    }).start(() => props.dragY.setValue(0))
  }
  const lockRecording = () => {
    animateDown()
    props.lockRecording()
  }
  const stopRecording = (stopType: Types.AudioStopType) => {
    animateDown()
    props.stopRecording(stopType)
  }
  return (
    <>
      <Tooltip visible={showToolTip} />
      <Kb.TapGestureHandler
        onHandlerStateChange={({nativeEvent}) => {
          if (!props.recording && nativeEvent.state === Kb.GestureState.BEGAN) {
            tapLive.current = true
            if (!longPressTimer) {
              longPressTimer = setTimeout(() => {
                if (tapLive.current) {
                  props.enableRecording()
                  setShowToolTip(false)
                }
              }, 200)
            }
          }
          if (nativeEvent.state === Kb.GestureState.ACTIVE || nativeEvent.state === Kb.GestureState.END) {
            clearTimeout(longPressTimer)
            tapLive.current = false
            longPressTimer = null
            if (!props.recording) {
              setShowToolTip(true)
              showToolTopFalseLater()
            }
            if (props.recording && nativeEvent.state === Kb.GestureState.END) {
              if (nativeEvent.x < maxCancelDrift) {
                stopRecording(Types.AudioStopType.CANCEL)
              } else if (nativeEvent.y < maxLockDrift) {
                lockRecording()
              } else {
                stopRecording(Types.AudioStopType.RELEASE)
              }
            }
          }
        }}
      >
        <Kb.PanGestureHandler
          minDeltaX={0}
          minDeltaY={0}
          onGestureEvent={({nativeEvent}) => {
            if (locked.current) {
              return
            }
            if (nativeEvent.translationY < maxLockDrift) {
              locked.current = true
              lockRecording()
            }
            if (nativeEvent.translationX < maxCancelDrift) {
              clearTimeout(longPressTimer)
              longPressTimer = null
              stopRecording(Types.AudioStopType.CANCEL)
            }
            if (!locked.current && nativeEvent.translationY <= 0) {
              props.dragY.setValue(nativeEvent.translationY)
            }
          }}
          onHandlerStateChange={({nativeEvent}) => {
            if (nativeEvent.state === Kb.GestureState.END) {
              if (locked.current) {
                return
              }
              if (nativeEvent.y < maxLockDrift) {
                lockRecording()
              }
              if (nativeEvent.x < maxCancelDrift) {
                clearTimeout(longPressTimer)
                longPressTimer = null
                stopRecording(Types.AudioStopType.CANCEL)
              } else {
                clearTimeout(longPressTimer)
                longPressTimer = null
                stopRecording(Types.AudioStopType.RELEASE)
              }
            }
          }}
        >
          <Kb.NativeView>
            <Kb.Icon type="iconfont-mic" style={Kb.iconCastPlatformStyles(props.iconStyle)} fontSize={22} />
          </Kb.NativeView>
        </Kb.PanGestureHandler>
      </Kb.TapGestureHandler>
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  tooltipContainer: {
    backgroundColor: Styles.globalColors.black,
    borderRadius: Styles.borderRadius,
    bottom: 95,
    padding: Styles.globalMargins.tiny,
    position: 'absolute',
    right: 20,
  },
}))

export default AudioStarter
