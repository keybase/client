import * as React from 'react'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/chat2'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import {Portal} from '@gorhom/portal'
import {View} from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  dragX: SharedValue<number>
  dragY: SharedValue<number>
  iconStyle?: Kb.IconStyle
  enableRecording: () => void
  stopRecording: (st: Types.AudioStopType) => void
  locked: boolean
}

const Tooltip = (props: {onHide: () => void}) => {
  const {onHide} = props
  const opacity = useSharedValue(0)
  opacity.value = withSequence(
    withTiming(1, {duration: 200}),
    withDelay(
      1000,
      withTiming(0, {duration: 200}, () => {
        runOnJS(onHide)()
      })
    )
  )
  const animatedStyles = useAnimatedStyle(() => ({opacity: opacity.value}))
  return (
    <Animated.View style={animatedStyles}>
      <Kb.Box2 direction="horizontal" style={styles.tooltipContainer}>
        <Kb.Text type="BodySmall" negative={true}>
          Hold to record audio.
        </Kb.Text>
      </Kb.Box2>
    </Animated.View>
  )
}

const maxCancelDrift = -120
const maxLockDrift = -100
const _AudioStarter = (props: Props) => {
  const {stopRecording, enableRecording, iconStyle, dragX, dragY, conversationIDKey, locked} = props
  const [showToolTip, setShowToolTip] = React.useState(false)
  const dispatch = Container.useDispatch()
  const lockRecording = React.useCallback(() => {
    dispatch(Chat2Gen.createLockAudioRecording({conversationIDKey}))
  }, [dispatch, conversationIDKey])

  const onHideTooltip = React.useCallback(() => {
    setShowToolTip(false)
  }, [])
  const stillGesturing = useSharedValue(false)
  const tapStartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    return () => {
      tapStartTimerRef.current && clearTimeout(tapStartTimerRef.current)
    }
  }, [])
  // after the initial tap see if we're still gesturing. if so we start to record, if not we show the tooltip
  const onTapStart = () => {
    tapStartTimerRef.current = setTimeout(() => {
      if (stillGesturing.value) {
        enableRecording()
        // TEMP testing js thread
        setTimeout(() => {
          // debugger
        }, 1000)
      } else {
        setShowToolTip(true)
      }
    }, 100)
  }

  const onTapEnd = () => {
    // we're locked, ignore the tap
    if (locked) {
      return
    } else {
      stopRecording(Types.AudioStopType.RELEASE)
    }
    // if (translationX.value < maxCancelDrift) {
    //   stopRecording(Types.AudioStopType.CANCEL)
    // } else if (translationY.value < maxLockDrift) {
    //   lockRecording()
    // } else {
    // }
  }

  const tapStart = useSharedValue(0)
  const translationX = useSharedValue(0)
  const translationY = useSharedValue(0)
  const tapGesture = Gesture.Tap()
    .maxDuration(Number.MAX_SAFE_INTEGER)
    .shouldCancelWhenOutside(false)
    .onBegin(() => {
      stillGesturing.value = true
      // mark the time
      tapStart.value = Date.now()
      // start the timer, when the timer fires we start recording
      runOnJS(onTapStart)()
    })
    .onEnd(() => {
      stillGesturing.value = false
      runOnJS(onTapEnd)()
    })

  const panGesture = Gesture.Pan().onUpdate(e => {
    translationX.value = e.translationX
    translationY.value = e.translationY
    dragY.value = interpolate(e.translationY, [maxLockDrift, 0], [maxLockDrift, 0], Extrapolation.CLAMP)
    dragX.value = interpolate(e.translationX, [maxCancelDrift, 0], [maxCancelDrift, 0], Extrapolation.CLAMP)

    if (e.translationX < maxCancelDrift) {
      runOnJS(stopRecording)(Types.AudioStopType.CANCEL)
    } else if (e.translationY < maxLockDrift) {
      runOnJS(lockRecording)()
    }
  })
  const composedGesture = Gesture.Simultaneous(tapGesture, panGesture)
  return (
    <>
      {showToolTip && (
        <Portal hostName="convOverlay">
          <Tooltip onHide={onHideTooltip} />
        </Portal>
      )}
      <View>
        <GestureDetector gesture={composedGesture}>
          <Kb.Icon type="iconfont-mic" style={iconStyle} />
        </GestureDetector>
      </View>
    </>
  )
}
const AudioStarter = React.memo(_AudioStarter)

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
