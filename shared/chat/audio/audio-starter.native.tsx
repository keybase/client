import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Types from '../../constants/types/chat2'
import * as Styles from '../../styles'
import {Gateway} from '@chardskarth/react-gateway'

type AudioStarterProps = {
  dragY: Kb.NativeAnimated.Value
  locked: boolean
  recording: boolean
  iconStyle?: Kb.IconStyle
  lockRecording: () => void
  enableRecording: () => void
  stopRecording: (st: Types.AudioStopType) => void
}

const maxCancelDrift = -20
const maxLockDrift = -70

type TooltipProps = {
  shouldBeVisible: boolean
}

const Tooltip = (props: TooltipProps) => {
  const opacity = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const [visible, setVisible] = React.useState(false)
  const {shouldBeVisible} = props
  React.useEffect(() => {
    if (shouldBeVisible) {
      setVisible(true)
      Kb.NativeAnimated.timing(opacity, {
        duration: 200,
        toValue: 1,
        useNativeDriver: true,
      }).start()
    } else {
      Kb.NativeAnimated.timing(opacity, {
        duration: 200,
        toValue: 0,
        useNativeDriver: true,
      }).start(() => setVisible(false))
    }
  }, [shouldBeVisible, opacity])
  return visible ? (
    <Kb.NativeAnimated.View style={{opacity}}>
      <Kb.Box2 direction="horizontal" style={styles.tooltipContainer}>
        <Kb.Text type="BodySmall" style={{color: Styles.globalColors.white}}>
          Hold to record audio.
        </Kb.Text>
      </Kb.Box2>
    </Kb.NativeAnimated.View>
  ) : null
}

const AudioStarter = (props: AudioStarterProps) => {
  let longPressTimer: null | ReturnType<typeof setTimeout>
  const locked = React.useRef<boolean>(false)
  const tapLive = React.useRef<boolean>(false)
  const tapRef = React.useRef(null)
  const panRef = React.useRef(null)
  const recordTimeRef = React.useRef(0)
  const [showToolTip, setShowToolTip] = React.useState(false)
  const showToolTipFalseLater = Kb.useTimeout(() => {
    setShowToolTip(false)
  }, 2000)
  React.useEffect(() => {
    if (locked.current && !props.locked) {
      locked.current = false
    }
  }, [props.locked])
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
      <Gateway into="convOverlay">
        <Tooltip shouldBeVisible={showToolTip} />
      </Gateway>
      <Kb.TapGestureHandler
        shouldCancelWhenOutside={false}
        onHandlerStateChange={({nativeEvent}) => {
          if (!props.recording && nativeEvent.state === Kb.GestureState.BEGAN) {
            tapLive.current = true
            if (!longPressTimer) {
              recordTimeRef.current = Date.now()
              longPressTimer = setTimeout(() => {
                if (tapLive.current) {
                  props.enableRecording()
                  setShowToolTip(false)
                }
              }, 100)
            }
          }
          if (
            nativeEvent.state === Kb.GestureState.ACTIVE ||
            nativeEvent.state === Kb.GestureState.END ||
            nativeEvent.state === Kb.GestureState.CANCELLED ||
            nativeEvent.state === Kb.GestureState.FAILED
          ) {
            longPressTimer && clearTimeout(longPressTimer)
            tapLive.current = false
            longPressTimer = null
            if (!props.recording && Date.now() - recordTimeRef.current <= 100) {
              setShowToolTip(true)
              showToolTipFalseLater()
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
        ref={tapRef}
        simultaneousHandlers={panRef}
      >
        <Kb.PanGestureHandler
          shouldCancelWhenOutside={false}
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
              longPressTimer && clearTimeout(longPressTimer)
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
                longPressTimer && clearTimeout(longPressTimer)
                longPressTimer = null
                stopRecording(Types.AudioStopType.CANCEL)
              } else {
                longPressTimer && clearTimeout(longPressTimer)
                longPressTimer = null
                stopRecording(Types.AudioStopType.RELEASE)
              }
            }
          }}
          ref={panRef}
          simultaneousHandlers={tapRef}
        >
          <Kb.NativeView>
            <Kb.Icon type="iconfont-mic" style={props.iconStyle} />
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
    bottom: 45,
    padding: Styles.globalMargins.tiny,
    position: 'absolute',
    right: 20,
  },
}))

export default AudioStarter
