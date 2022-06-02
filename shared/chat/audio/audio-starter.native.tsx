import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/chat2'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import {Portal} from '@gorhom/portal'
import {View} from 'react-native'
import {runOnJS} from 'react-native-reanimated'

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
  const {recording, locked, dragY, lockRecording, stopRecording, enableRecording, iconStyle} = props
  const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lockedRef = React.useRef<boolean>(false)
  const tapLiveRef = React.useRef<boolean>(false)
  const recordTimeRef = React.useRef(0)
  const [showToolTip, setShowToolTip] = React.useState(false)
  const showToolTipFalseLater = Kb.useTimeout(() => {
    setShowToolTip(false)
  }, 2000)
  React.useEffect(() => {
    if (lockedRef.current && !locked) {
      lockedRef.current = false
    }
  }, [locked])
  const animateDown = React.useCallback(() => {
    Kb.NativeAnimated.timing(dragY, {
      duration: 400,
      easing: Kb.NativeEasing.elastic(1),
      toValue: 0,
      useNativeDriver: true,
    }).start(() => dragY.setValue(0))
  }, [dragY])
  const _lockRecording = React.useCallback(() => {
    animateDown()
    lockRecording()
  }, [lockRecording, animateDown])
  const _stopRecording = (stopType: Types.AudioStopType) => {
    animateDown()
    stopRecording(stopType)
  }

  const startTap = React.useCallback(() => {
    console.log('aaa tap!')
    if (recording) {
      return
    }
    tapLiveRef.current = true
    if (!longPressTimerRef.current) {
      recordTimeRef.current = Date.now()
      longPressTimerRef.current = setTimeout(() => {
        if (tapLiveRef.current) {
          enableRecording()
          setShowToolTip(false)
        }
      }, 100)
    }
  }, [enableRecording, setShowToolTip, recording])

  const tapGesture = Gesture.Tap()
    .maxDuration(Number.MAX_SAFE_INTEGER)
    .shouldCancelWhenOutside(false)
    .onBegin(() => {
      'worklet'
      runOnJS(startTap)
    })
  onGestureEvent(({x, y}) => {}).onEnd(({x, y}) => {
    console.log('aaa', {x, y})
    longPressTimerRef.current && clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
    tapLiveRef.current = false
    if (!recording && Date.now() - recordTimeRef.current <= 100) {
      setShowToolTip(true)
      showToolTipFalseLater()
    }
    if (recording) {
      if (x < maxCancelDrift) {
        _stopRecording(Types.AudioStopType.CANCEL)
      } else if (y < maxLockDrift) {
        _lockRecording()
      } else {
        _stopRecording(Types.AudioStopType.RELEASE)
      }
    }
  })
  const panGesture = Gesture.Pan().onStart(() => {
    console.log('aaa pan!')
  })
  const composedGesture = Gesture.Simultaneous(tapGesture, panGesture)
  return (
    <>
      <Portal hostName="convOverlay">
        <Tooltip shouldBeVisible={showToolTip} />
      </Portal>
      <View>
        <GestureDetector gesture={composedGesture}>
          <Kb.Icon type="iconfont-mic" style={iconStyle} />
        </GestureDetector>
      </View>
    </>
  )
}

// <Kb.TapGestureHandler
//   shouldCancelWhenOutside={false}
//   maxDurationMs={Number.MAX_SAFE_INTEGER}
//   onHandlerStateChange={({nativeEvent}) => {
//     if (
//       nativeEvent.state === Kb.GestureState.ACTIVE ||
//       nativeEvent.state === Kb.GestureState.END ||
//       nativeEvent.state === Kb.GestureState.CANCELLED ||
//       nativeEvent.state === Kb.GestureState.FAILED
//     ) {
//       longPressTimer && clearTimeout(longPressTimer)
//       tapLive.current = false
//       longPressTimer = null
//       if (!props.recording && Date.now() - recordTimeRef.current <= 100) {
//         setShowToolTip(true)
//         showToolTipFalseLater()
//       }
//       if (props.recording && nativeEvent.state === Kb.GestureState.END) {
//         if (nativeEvent.x < maxCancelDrift) {
//           stopRecording(Types.AudioStopType.CANCEL)
//         } else if (nativeEvent.y < maxLockDrift) {
//           lockRecording()
//         } else {
//           stopRecording(Types.AudioStopType.RELEASE)
//         }
//       }
//     }
//   }}
//   ref={tapRef}
//   simultaneousHandlers={panRef}
// >
//   <Kb.PanGestureHandler
//     shouldCancelWhenOutside={false}
//     // @ts-ignore
//     minDeltaX={0}
//     minDeltaY={0}
//     onGestureEvent={({nativeEvent}) => {
//       if (locked.current) {
//         return
//       }
//       if (nativeEvent.translationY < maxLockDrift) {
//         locked.current = true
//         lockRecording()
//       }
//       if (nativeEvent.translationX < maxCancelDrift) {
//         longPressTimer && clearTimeout(longPressTimer)
//         longPressTimer = null
//         stopRecording(Types.AudioStopType.CANCEL)
//       }
//       if (!locked.current && nativeEvent.translationY <= 0) {
//         props.dragY.setValue(nativeEvent.translationY)
//       }
//     }}
//     onHandlerStateChange={({nativeEvent}) => {
//       if (nativeEvent.state === Kb.GestureState.END) {
//         if (locked.current) {
//           return
//         }
//         if (nativeEvent.y < maxLockDrift) {
//           lockRecording()
//         }
//         if (nativeEvent.x < maxCancelDrift) {
//           longPressTimer && clearTimeout(longPressTimer)
//           longPressTimer = null
//           stopRecording(Types.AudioStopType.CANCEL)
//         } else {
//           longPressTimer && clearTimeout(longPressTimer)
//           longPressTimer = null
//           stopRecording(Types.AudioStopType.RELEASE)
//         }
//       }
//     }}
//     ref={panRef}
//     simultaneousHandlers={tapRef}
//   >

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
