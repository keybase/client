import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import {formatAudioRecordDuration} from '../../util/timestamp'
import {isIOS} from '../../constants/platform'
import {AmpTracker} from './amptracker'
import AudioStarter from './audio-starter.native'
import {Portal} from '@gorhom/portal'
import {View} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  iconStyle?: Kb.IconStyle
}

const unifyAmp = (amp: number) => {
  return isIOS ? 10 ** (amp * 0.05) : Math.min(1.0, amp / 22000)
}

const AudioRecorder = (props: Props) => {
  const {conversationIDKey} = props
  const ampScale = useSharedValue(0)
  const dragY = useSharedValue(0)
  const initialBounce = useSharedValue(0)

  const ampTracker = React.useRef(new AmpTracker()).current
  const [visible, setVisible] = React.useState(false)
  const [closingDown, setClosingDown] = React.useState(false)
  const audioRecording = Container.useSelector(state => state.chat2.audioRecording.get(conversationIDKey))
  const locked = audioRecording?.isLocked ?? false

  console.log('bbb audio recorder', {visible, initialBounce})
  React.useEffect(() => {
    if (visible) {
      initialBounce.value = withTiming(1, {
        duration: 500,
        easing: Easing.elastic(1),
      })
    } else {
      initialBounce.value = 0
    }
  }, [visible])

  const dispatch = Container.useDispatch()
  const meteringCb = React.useCallback(
    (inamp: number) => {
      const amp = unifyAmp(inamp)
      ampTracker.addAmp(amp)
      if (!closingDown) {
        ampScale.value = withTiming(ampToScale(amp), {duration: 100})
      }
    },
    [ampTracker, ampScale]
  )
  const onCancel = React.useCallback(() => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.CANCEL}))
  }, [dispatch, conversationIDKey])
  const lockRecording = React.useCallback(() => {
    !locked && dispatch(Chat2Gen.createLockAudioRecording({conversationIDKey}))
  }, [dispatch, conversationIDKey, locked])
  const enableRecording = React.useCallback(() => {
    ampTracker.reset()
    dispatch(Chat2Gen.createAttemptAudioRecording({conversationIDKey, meteringCb}))
  }, [dispatch, conversationIDKey, ampTracker, meteringCb])
  const stopRecording = React.useCallback(
    (stopType: Types.AudioStopType) => {
      dispatch(
        Chat2Gen.createStopAudioRecording({
          amps: ampTracker,
          conversationIDKey,
          stopType,
        })
      )
    },
    [dispatch, ampTracker, conversationIDKey]
  )
  const sendRecording = React.useCallback(() => stopRecording(Types.AudioStopType.SEND), [stopRecording])
  const stageRecording = React.useCallback(() => {
    stopRecording(Types.AudioStopType.STOPBUTTON)
  }, [stopRecording])

  // render
  const noShow = !Constants.showAudioRecording(audioRecording)
  if (!visible && !noShow) {
    setClosingDown(false)
    setVisible(true)
  } else if (visible && noShow && !closingDown) {
    setClosingDown(true)
    initialBounce.value = withTiming(0)
    setTimeout(() => setVisible(false), 500)
  }

  React.useEffect(() => {
    if (closingDown || locked) {
      dragY.value = 0
    }
  }, [locked, closingDown, dragY])

  // const recording =
  //   !!audioRecording &&
  //   (audioRecording.status === Types.AudioRecordingStatus.INITIAL ||
  //     audioRecording.status === Types.AudioRecordingStatus.RECORDING)
  return (
    <>
      <AudioStarter
        dragY={dragY}
        lockRecording={lockRecording}
        enableRecording={enableRecording}
        stopRecording={stopRecording}
        iconStyle={props.iconStyle}
      />
      {!visible ? null : (
        <Portal hostName="convOverlay">
          <Kb.Box2
            direction="vertical"
            fullHeight={true}
            fullWidth={true}
            style={styles.container}
            pointerEvents="box-none"
          >
            <AudioButton
              ampScale={ampScale}
              closingDown={closingDown}
              dragY={dragY}
              locked={locked}
              sendRecording={sendRecording}
              initialBounce={initialBounce}
              stageRecording={stageRecording}
            />
            <AudioSlideToCancel
              closingDown={closingDown}
              locked={locked}
              onCancel={onCancel}
              translate={initialBounce}
            />
            <AudioCounter initialBounce={initialBounce} />
          </Kb.Box2>
        </Portal>
      )}
    </>
  )
}

type ButtonProps = {
  ampScale: SharedValue<number>
  closingDown: boolean
  dragY: SharedValue<number>
  locked: boolean
  sendRecording: () => void
  initialBounce: SharedValue<number>
  stageRecording: () => void
}

const maxScale = 8
const minScale = 3
const ampToScale = (amp: number) => {
  return minScale + amp * (maxScale - minScale)
}

const AudioButton = (props: ButtonProps) => {
  const {initialBounce, locked, closingDown, ampScale, dragY, sendRecording, stageRecording} = props
  console.log('bbb audiobutton render', {initialBounce})
  const innerScale = useSharedValue(0)
  const outerScale = useSharedValue(0)
  const sendTranslate = useSharedValue(0)
  const innerOffsetY = useSharedValue(-34)
  const ampOffsetY = useSharedValue(-31)
  const micOffsetY = useSharedValue(-34)

  innerScale.value = withTiming(3, {easing: Easing.elastic(1)})
  outerScale.value = withTiming(Styles.isTablet ? 40 : 15, {
    duration: 200,
    easing: Easing.inOut(Easing.ease),
  })
  React.useEffect(() => {
    if (locked) {
      sendTranslate.value = withTiming(1, {
        easing: Easing.elastic(1),
      })
    }
  }, [locked, sendTranslate])

  React.useEffect(() => {
    console.log('bbb audiobutton useeffect ', {closingDown})
    if (!closingDown) {
      return
    }
    outerScale.value = withTiming(0)
    innerScale.value = withTiming(0)
    sendTranslate.value = withTiming(0)
    ampScale.value = withTiming(0)
  }, [closingDown, innerScale, outerScale, sendTranslate, ampScale])

  const innerSize = 28
  const ampSize = 34
  const outerSize = 50

  const outerScaleStyle = useAnimatedStyle(() => ({
    transform: [{scale: outerScale.value}],
  }))
  const ampSizeStyle = useAnimatedStyle(() => ({
    transform: [{translateY: ampOffsetY.value + (locked ? 0 : dragY.value)}, {scale: ampScale.value}],
  }))
  const innerSizeStyle = useAnimatedStyle(() => {
    console.log('bbb inner size style', innerScale.value, closingDown)
    return {
      transform: [{translateY: innerOffsetY.value + (locked ? 0 : dragY.value)}, {scale: innerScale.value}],
    }
  })
  const upArrowStyle = useAnimatedStyle(() => ({
    opacity: initialBounce.value,
    transform: [{translateY: interpolate(initialBounce.value, [0, 1], [180, 0])}],
  }))
  const lockStyle = useAnimatedStyle(() => ({
    opacity: initialBounce.value,
    transform: [
      {translateY: interpolate(initialBounce.value, [0, 1], [180, 0])},
      {translateY: interpolate(dragY.value, [-70, 0], [-10, 0])},
    ],
  }))
  const arrowFullUpStyle = useAnimatedStyle(() => ({
    opacity: initialBounce.value,
    transform: [{translateY: interpolate(sendTranslate.value, [0, 1], [180, 0])}],
  }))
  const micStyle = useAnimatedStyle(() => ({
    transform: [{translateY: micOffsetY.value + dragY.value}],
  }))

  return (
    <>
      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            backgroundColor: Styles.globalColors.white,
            borderRadius: outerSize / 2,
            bottom: 20,
            height: outerSize,
            opacity: 0.9,
            position: 'absolute',
            right: 30,
            width: outerSize,
          },
          outerScaleStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            backgroundColor: locked
              ? Styles.globalColors.redLight
              : Styles.globalColors.blueLighterOrBlueLight,
            borderRadius: ampSize / 2,
            height: ampSize,
            position: 'absolute',
            right: 40,
            width: ampSize,
          },
          ampSizeStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            backgroundColor: locked ? Styles.globalColors.red : Styles.globalColors.blue,
            borderRadius: innerSize / 2,
            height: innerSize,
            position: 'absolute',
            right: 43,
            width: innerSize,
          },
          innerSizeStyle,
        ]}
      />
      {locked ? (
        <Animated.View style={[{bottom: 130, position: 'absolute', right: 42}, arrowFullUpStyle]}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: Styles.globalColors.blue,
              borderRadius: 16,
              height: 32,
              justifyContent: 'center',
              width: 32,
            }}
          >
            <Kb.ClickableBox
              onClick={sendRecording}
              style={{alignItems: 'center', height: 32, justifyContent: 'center', width: 32}}
            >
              <Kb.Icon
                color={Styles.globalColors.whiteOrWhite}
                sizeType="Small"
                type="iconfont-arrow-full-up"
              />
            </Kb.ClickableBox>
          </View>
        </Animated.View>
      ) : (
        <>
          <Animated.View style={[{bottom: 160, position: 'absolute', right: 50}, upArrowStyle]}>
            <View>
              <Kb.Icon type="iconfont-arrow-up" sizeType="Tiny" />
            </View>
          </Animated.View>
          <Animated.View style={[{bottom: 130, position: 'absolute', right: 45}, lockStyle]}>
            <Kb.Icon type="iconfont-lock" />
          </Animated.View>
        </>
      )}

      {!locked ? (
        <Animated.View style={[{position: 'absolute', right: 44, top: -4}, micStyle]}>
          <Kb.Icon type="iconfont-mic" color={Styles.globalColors.whiteOrWhite} />
        </Animated.View>
      ) : (
        <View
          style={{
            bottom: 22,
            height: 48,
            justifyContent: 'center',
            position: 'absolute',
            right: 19,
            width: 48,
          }}
        >
          <Kb.Icon type="iconfont-stop" color={Styles.globalColors.whiteOrWhite} onClick={stageRecording} />
        </View>
      )}
    </>
  )
}

type CancelProps = {
  closingDown: boolean
  locked: boolean
  onCancel: () => void
  translate: SharedValue<number>
}

const AudioSlideToCancel = (props: CancelProps) => {
  const cancelTranslate = useSharedValue(0)
  const {closingDown, translate, locked, onCancel} = props
  React.useEffect(() => {
    if (closingDown) {
      cancelTranslate.value = withTiming(1)
    }
  }, [closingDown, cancelTranslate])

  const cancelStyle = useAnimatedStyle(() => ({
    transform: [{translateY: interpolate(cancelTranslate.value, [0, 1], [0, 85])}],
  }))
  const transStyle = useAnimatedStyle(() => ({
    opacity: translate.value,
    transform: [{translateX: interpolate(translate.value, [0, 1], [-10, -125])}],
  }))

  return locked ? (
    <Animated.View style={[{bottom: 27, left: 100, position: 'absolute'}, cancelStyle]}>
      <Kb.ClickableBox onClick={onCancel} style={{alignItems: 'center', height: 30}}>
        <Kb.Text type="BodyBigLink">Cancel</Kb.Text>
      </Kb.ClickableBox>
    </Animated.View>
  ) : (
    <Animated.View
      pointerEvents="box-none"
      style={[{bottom: 35, position: 'absolute', right: 0}, transStyle]}
    >
      <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
        <Kb.Icon sizeType="Tiny" type="iconfont-arrow-left" />
        <Kb.Text type="BodySmall" onClick={onCancel}>
          Slide to cancel
        </Kb.Text>
      </Kb.Box2>
    </Animated.View>
  )
}

type CounterProps = {
  initialBounce: SharedValue<number>
}

const AudioCounter = (props: CounterProps) => {
  const {initialBounce} = props
  const [seconds, setSeconds] = React.useState(0)
  const [startTime] = React.useState(Date.now())
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
    <Animated.View style={[{bottom: 35, left: 10, position: 'absolute'}, durationStyle]}>
      <Kb.Text type="BodyBold">{formatAudioRecordDuration(seconds * 1000)}</Kb.Text>
    </Animated.View>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.fillAbsolute,
    justifyContent: 'flex-end',
    padding: Styles.globalMargins.tiny + 3,
  },
}))

export default AudioRecorder
