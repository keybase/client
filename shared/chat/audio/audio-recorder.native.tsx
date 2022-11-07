import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import {formatAudioRecordDuration} from '../../util/timestamp'
import {AmpTracker} from './amptracker'
import AudioStarter from './audio-starter.native'
import {Portal} from '@gorhom/portal'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  withTiming,
  withSpring,
  type SharedValue,
  runOnJS,
  Extrapolation,
} from 'react-native-reanimated'

type SVN = SharedValue<number>

type Props = {
  conversationIDKey: Types.ConversationIDKey
  iconStyle?: Kb.IconStyle
}

// hook to help deal with visibility request changing. we animate in / out and truly hide when we're done animating
const useVisible = (reduxVisible: boolean, dragX: SVN, dragY: SVN) => {
  const [visible, setVisible] = React.useState(reduxVisible)
  const initialBounce = useSharedValue(reduxVisible ? 1 : 0)
  React.useEffect(() => {
    // not showing somehow? immediately show
    if (!visible && reduxVisible) {
      setVisible(true)
    }
    initialBounce.value = reduxVisible
      ? withSpring(1)
      : withTiming(0, {duration: 200}, () => {
          // hide after we're done animating
          runOnJS(setVisible)(false)
        })

    if (!reduxVisible) {
      dragX.value = withTiming(0)
      dragY.value = withTiming(0)
    }
  }, [initialBounce, visible, reduxVisible, dragX, dragY])

  return {initialBounce, visible}
}

const useRecording = (conversationIDKey: Types.ConversationIDKey) => {
  const ampTracker = React.useRef(new AmpTracker()).current
  const ampScale = useSharedValue(0)
  const ampToScale = (amp: number) => {
    const maxScale = 8
    const minScale = 3
    return minScale + amp * (maxScale - minScale)
  }
  const meteringCb = React.useCallback(
    (inamp: number) => {
      const amp = 10 ** (inamp * 0.05)
      ampTracker.addAmp(amp)
      ampScale.value = withTiming(ampToScale(amp), {duration: 100})
    },
    [ampTracker, ampScale]
  )
  const dispatch = Container.useDispatch()
  const enableRecording = React.useCallback(() => {
    ampTracker.reset()
    dispatch(Chat2Gen.createAttemptAudioRecording({conversationIDKey, meteringCb}))
  }, [dispatch, conversationIDKey, ampTracker, meteringCb])
  const stopRecording = React.useCallback(
    (stopType: Types.AudioStopType) => {
      dispatch(Chat2Gen.createStopAudioRecording({amps: ampTracker, conversationIDKey, stopType}))
    },
    [dispatch, ampTracker, conversationIDKey]
  )

  return {ampScale, enableRecording, stopRecording}
}

const AudioRecorder = (props: Props) => {
  const {conversationIDKey} = props
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const audioRecording = Container.useSelector(state => state.chat2.audioRecording.get(conversationIDKey))
  // if redux wants us to show or not, we animate before we change our internal state
  const reduxVisible = Constants.showAudioRecording(audioRecording)
  const locked = audioRecording?.isLocked ?? false
  const {initialBounce, visible} = useVisible(reduxVisible, dragX, dragY)
  const {ampScale, enableRecording, stopRecording} = useRecording(conversationIDKey)
  const dispatch = Container.useDispatch()
  const onCancel = React.useCallback(() => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.CANCEL}))
  }, [dispatch, conversationIDKey])
  return (
    <>
      <AudioStarter
        conversationIDKey={conversationIDKey}
        dragY={dragY}
        dragX={dragX}
        enableRecording={enableRecording}
        stopRecording={stopRecording}
        locked={locked}
        iconStyle={props.iconStyle}
      />
      <Portal hostName="convOverlay">
        {!visible ? null : (
          <Animated.View style={styles.container} pointerEvents="box-none">
            <BigBackground initialBounce={initialBounce} />
            <AmpCircle
              initialBounce={initialBounce}
              ampScale={ampScale}
              dragX={dragX}
              dragY={dragY}
              locked={locked}
            />
            <InnerCircle
              initialBounce={initialBounce}
              dragX={dragX}
              dragY={dragY}
              locked={locked}
              stopRecording={stopRecording}
            />
            <LockHint initialBounce={initialBounce} dragX={dragX} dragY={dragY} locked={locked} />
            <CancelHint onCancel={onCancel} initialBounce={initialBounce} locked={locked} dragX={dragX} />
            <SendRecordingButton
              initialBounce={initialBounce}
              locked={locked}
              stopRecording={stopRecording}
            />
            <AudioCounter initialBounce={initialBounce} />
          </Animated.View>
        )}
      </Portal>
    </>
  )
}

const BigBackground = (props: {initialBounce: SVN}) => {
  const {initialBounce} = props
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: initialBounce.value * 0.9,
    transform: [{scale: initialBounce.value}],
  }))
  return <Animated.View pointerEvents="box-none" style={[styles.bigBackgroundStyle, animatedStyle]} />
}

const AmpCircle = (props: {ampScale: SVN; dragX: SVN; dragY: SVN; initialBounce: SVN; locked: boolean}) => {
  const {ampScale, dragX, dragY, initialBounce, locked} = props
  const animatedStyle = useAnimatedStyle(() => {
  const dragDistanceX = -50
  const dragXOpacity = dragY.value < -10 ? 1 : interpolate(dragX.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
  return ({
    opacity: withTiming(dragXOpacity),
    transform: [{translateY: locked ? 0 : dragY.value}, {scale: ampScale.value * initialBounce.value}],
  })}
    )
  return (
    <Animated.View
      style={[
        styles.ampCircleStyle,
        {backgroundColor: locked ? Styles.globalColors.redLight : Styles.globalColors.blueLighterOrBlueLight},
        animatedStyle,
      ]}
    />
  )
}

const InnerCircle = (props: {
  dragX: SVN
  dragY: SVN
  initialBounce: SVN
  locked: boolean
  stopRecording: (stopType: Types.AudioStopType) => void
}) => {
  const {dragX, dragY, initialBounce, locked, stopRecording} = props
  const circleStyle = useAnimatedStyle(() => {
  // worklet needs this locally for some reason
  const dragDistanceX = -50
  const dragXOpacity = dragY.value < -10 ? 1 : interpolate(dragX.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
  return ({
    opacity: withTiming(dragXOpacity),
    transform: [{translateY: locked ? 0 : dragY.value}, {scale: initialBounce.value}],
  })})
  const stopStyle = useAnimatedStyle(() => ({opacity: locked ? withTiming(1) : 0}))
  const onStop = React.useCallback(() => {
    stopRecording(Types.AudioStopType.STOPBUTTON)
  }, [stopRecording])
  return (
    <Animated.View
      style={[
        styles.innerCircleStyle,
        {backgroundColor: locked ? Styles.globalColors.red : Styles.globalColors.blue},
        circleStyle,
      ]}
    >
      <AnimatedIcon
        type="iconfont-stop"
        color={Styles.globalColors.whiteOrWhite}
        onClick={onStop}
        style={stopStyle}
      />
    </Animated.View>
  )
}

const LockHint = (props: {initialBounce: SVN; locked: boolean; dragX: SVN; dragY: SVN}) => {
  const {locked, initialBounce, dragX, dragY} = props
  const slideAmount = 150
  const spaceBetween = 20
  const deltaY = 50
  const arrowStyle = useAnimatedStyle(() => {

  // worklet needs this locally for some reason
  const dragDistanceX = -50
  const dragXOpacity = dragY.value < -10 ? 1 : interpolate(dragX.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
        return ({
    opacity: locked
      ? withTiming(0)
      : initialBounce.value *
        interpolate(dragY.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP) *
        dragXOpacity,
    transform: [{translateX: 10}, {translateY: deltaY - initialBounce.value * slideAmount}],
  })})
  const lockStyle = useAnimatedStyle(() => {

  // worklet needs this locally for some reason
  const dragDistanceX = -50
  const dragXOpacity = dragY.value < -10 ? 1 : interpolate(dragX.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)

        return ({
    opacity: locked ? withTiming(0) : initialBounce.value * dragXOpacity,
    transform: [
      {translateX: 5},
      {
        translateY:
          deltaY +
          spaceBetween -
          initialBounce.value * slideAmount -
          interpolate(dragY.value, [dragDistanceX, 0], [spaceBetween, 0], Extrapolation.CLAMP),
      },
    ],
  })})
  return (
    <>
      <AnimatedIcon type="iconfont-arrow-up" sizeType="Tiny" style={[styles.lockHintStyle, arrowStyle]} />
      <AnimatedIcon type="iconfont-lock" style={[styles.lockHintStyle, lockStyle]} />
    </>
  )
}

const AnimatedIcon = Animated.createAnimatedComponent(Kb.Icon)
const AnimatedText = Animated.createAnimatedComponent(Kb.Text)

const dragDistanceX = -50

const CancelHint = (props: {initialBounce: SVN; dragX: SVN; locked: boolean; onCancel: () => void}) => {
  const {locked, initialBounce, onCancel, dragX} = props
  const deltaX = 180
  const slideAmount = 220
  const spaceBetween = 20
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: locked
      ? withTiming(0)
      : initialBounce.value * interpolate(dragX.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP),
    transform: [{translateX: deltaX - spaceBetween - initialBounce.value * slideAmount}, {translateY: -4}],
  }))
  const closeStyle = useAnimatedStyle(() => ({
    opacity: locked
      ? withTiming(0)
      : initialBounce.value * interpolate(dragX.value, [dragDistanceX, 0], [1, 0], Extrapolation.CLAMP),
    transform: [{translateX: deltaX - spaceBetween - initialBounce.value * slideAmount}, {translateY: -4}],
  }))
  const textStyle = useAnimatedStyle(() => ({
    opacity: initialBounce.value,
    transform: [
      {
        translateX:
          deltaX -
          initialBounce.value * slideAmount -
          interpolate(dragX.value, [dragDistanceX, 0], [8, 0], Extrapolation.CLAMP),
      },
    ],
  }))

  return (
    <>
      <AnimatedIcon
        sizeType="Tiny"
        type={'iconfont-arrow-left'}
        style={[styles.cancelHintStyle, arrowStyle]}
      />
      <AnimatedIcon sizeType="Tiny" type={'iconfont-close'} style={[styles.cancelHintStyle, closeStyle]} />
      <AnimatedText
        type={locked ? 'BodySmallPrimaryLink' : 'BodySmall'}
        onClick={onCancel}
        style={[styles.cancelHintStyle, textStyle]}
      >
        {locked ? 'Cancel' : 'Slide to cancel'}
      </AnimatedText>
    </>
  )
}

const SendRecordingButton = (props: {
  initialBounce: SVN
  locked: boolean
  stopRecording: (stopType: Types.AudioStopType) => void
}) => {
  const {initialBounce, locked, stopRecording} = props
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: locked ? initialBounce.value : withTiming(0),
    transform: [{translateY: withTiming(locked ? -100 : 50)}],
  }))
  const onSend = React.useCallback(() => {
    stopRecording(Types.AudioStopType.SEND)
  }, [stopRecording])
  return (
    <Animated.View style={[styles.sendRecordingButtonStyle, buttonStyle]}>
      <Kb.Icon
        padding="tiny"
        color={Styles.globalColors.whiteOrWhite}
        onClick={onSend}
        sizeType="Small"
        type="iconfont-arrow-full-up"
      />
    </Animated.View>
  )
}

const AudioCounter = (props: {initialBounce: SVN}) => {
  const {initialBounce} = props
  const [seconds, setSeconds] = React.useState(0)
  const startTime = React.useRef(Date.now()).current
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSeconds((Date.now() - startTime) / 1000)
    }, 1000)
    return () => clearTimeout(timer)
  }, [seconds, startTime])
  const durationStyle = useAnimatedStyle(() => ({
    opacity: initialBounce.value,
  }))
  return (
    <Animated.View style={[styles.audioCounterStyle, durationStyle]}>
      <Kb.Text type="BodyBold">{formatAudioRecordDuration(seconds * 1000)}</Kb.Text>
    </Animated.View>
  )
}

const micCenterRight = 54
const micCenterBottom = 26
const centerAroundIcon = (size: number) => {
  return {
    bottom: micCenterBottom - size / 2,
    height: size,
    position: 'absolute' as const,
    right: micCenterRight - size / 2,
    width: size,
  }
}
const circleAroundIcon = (size: number) => ({
  ...centerAroundIcon(size),
  borderRadius: size / 2,
})

const styles = Styles.styleSheetCreate(() => ({
  ampCircleStyle: {
    ...circleAroundIcon(34),
  },
  audioCounterStyle: {
    bottom: micCenterBottom - 10,
    left: 10,
    position: 'absolute',
  },
  bigBackgroundStyle: {
    ...circleAroundIcon(Styles.isTablet ? 2000 : 750),
    backgroundColor: Styles.globalColors.white,
  },
  cancelHintIcon: {
    left: 0,
    position: 'absolute',
  },
  cancelHintStyle: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    bottom: micCenterBottom - 10,
    paddingLeft: 20,
    position: 'absolute' as const,
    right: micCenterRight,
    width: 140,
  },
  container: {
    ...Styles.globalStyles.fillAbsolute,
    justifyContent: 'flex-start',
  },
  innerCircleStyle: {
    ...circleAroundIcon(84),
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockHintStyle: {
    ...centerAroundIcon(32),
  },
  sendRecordingButtonStyle: {
    ...circleAroundIcon(32),
    alignItems: 'center',
    backgroundColor: Styles.globalColors.blue,
    justifyContent: 'center',
  },
}))

export default AudioRecorder
