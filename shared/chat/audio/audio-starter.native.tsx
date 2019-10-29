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

const AudioStarter = (props: AudioStarterProps) => {
  let longPressTimer
  const locked = React.useRef<boolean>(false)
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
    <Kb.TapGestureHandler
      onHandlerStateChange={({nativeEvent}) => {
        if (!props.recording && nativeEvent.state === Kb.GestureState.BEGAN) {
          if (!longPressTimer) {
            longPressTimer = setTimeout(props.enableRecording, 200)
          }
        }
        if (nativeEvent.state === Kb.GestureState.ACTIVE || nativeEvent.state === Kb.GestureState.END) {
          clearTimeout(longPressTimer)
          longPressTimer = null
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
          <Kb.Icon type="iconfont-mic" style={props.iconStyle} fontSize={22} />
        </Kb.NativeView>
      </Kb.PanGestureHandler>
    </Kb.TapGestureHandler>
  )
}

export default AudioStarter
