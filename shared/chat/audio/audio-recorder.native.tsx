import * as Chat2Gen from '../../actions/chat2-gen'
import * as Container from '../../util/container'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Kb from '../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../styles'
// we need to use the raw colors to animate
import {colors} from '../../styles/colors'
import type * as Types from '../../constants/types/chat2'
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import {AmpTracker} from './amptracker'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import {Portal} from '@gorhom/portal'
import {View} from 'react-native'
import {formatAudioRecordDuration} from '../../util/timestamp'
import {Audio, InterruptionModeIOS, InterruptionModeAndroid} from 'expo-av'
import logger from '../../logger'
import * as Haptics from 'expo-haptics'
import * as FileSystem from 'expo-file-system'
import AudioSend from './audio-send'

type SVN = SharedValue<number>

type Props = {
  conversationIDKey: Types.ConversationIDKey
  showAudioSend: boolean
  setShowAudioSend: (s: boolean) => void
}

// enum AudioStopType {
//   CANCEL = 0,
//   RELEASE,
//   SEND,
//   STOPBUTTON,
// }

// type AudioRecordingInfo = {
//   outboxID: Buffer
//   path: string
//   recordEnd?: number
//   recordStart: number
//   amps?: AmpTracker
// }

// enum AudioRecordingStatus {
//   INITIAL = 0,
//   RECORDING,
//   STAGED,
//   STOPPED,
//   CANCELLED,
// }

// const audioRecordingDuration = (recordStart: number, recordEnd?: number) => {
//   return (recordEnd || recordStart) - recordStart
// }

// const makeAudioRecordingInfo = (): AudioRecordingInfo => ({
//   outboxID: new Buffer('hex'),
//   path: '',
//   recordStart: Date.now(),
// })

// const showAudioRecording = (status: AudioRecordingStatus) => {
//   return !(
//     status === AudioRecordingStatus.INITIAL ||
//     status === AudioRecordingStatus.STOPPED ||
//     status === AudioRecordingStatus.STAGED ||
//     status === AudioRecordingStatus.CANCELLED
//   )
// }

// const isStoppedAudioRecordingStatus = (status: AudioRecordingStatus) => {
//   return (
//     status === AudioRecordingStatus.STOPPED ||
//     status === AudioRecordingStatus.STAGED ||
//     status === AudioRecordingStatus.CANCELLED
//   )
// }

enum Visible {
  HIDDEN,
  START_HIDDEN,
  SHOW,
}

const useTooltip = () => {
  const [showTooltip, setShowTooltip] = React.useState(false)
  const opacitySV = useSharedValue(0)

  const animatedStyles = useAnimatedStyle(() => ({opacity: opacitySV.value}))

  opacitySV.value = showTooltip
    ? withSequence(
        withTiming(1, {duration: 200}),
        withDelay(
          1000,
          withTiming(0, {duration: 200}, () => {
            runOnJS(setShowTooltip)(false)
          })
        )
      )
    : 0

  const tooltip = showTooltip ? (
    <Portal hostName="convOverlay">
      <Animated.View style={animatedStyles}>
        <Kb.Box2 direction="horizontal" style={styles.tooltipContainer}>
          <Kb.Text type="BodySmall" negative={true}>
            Hold to record audio.
          </Kb.Text>
        </Kb.Box2>
      </Animated.View>
    </Portal>
  ) : null

  const flashTip = React.useCallback(() => {
    setShowTooltip(true)
  }, [setShowTooltip])

  return {flashTip, tooltip}
}

const useIconAndOverlay = (p: {
  flashTip: () => void
  startRecording: () => void
  sendRecording: () => void
  stageRecording: () => void
  cancelRecording: () => void
  ampSV: SVN
}) => {
  const {stageRecording, startRecording, sendRecording, cancelRecording, flashTip, ampSV} = p
  const [panEnabled, setPanEnabled] = React.useState(true)
  const [visible, setVisible] = React.useState(Visible.HIDDEN)
  const [locked, setLocked] = React.useState(false)
  // for reanimated only, react uses the above
  const lockedSV = useSharedValue(0)
  const dragXSV = useSharedValue(0)
  const dragYSV = useSharedValue(0)

  const onReset = React.useCallback(() => {
    setPanEnabled(true)
    setVisible(Visible.START_HIDDEN)
    dragXSV.value = 0
    dragYSV.value = 0
    lockedSV.value = 0
    setLocked(false)
  }, [setPanEnabled, setVisible, dragXSV, dragYSV, setLocked, lockedSV])

  const onCancelRecording = React.useCallback(() => {
    onReset()
    cancelRecording()
  }, [cancelRecording, onReset])

  const onStageRecording = React.useCallback(() => {
    onReset()
    stageRecording()
  }, [stageRecording, onReset])

  const onSendRecording = React.useCallback(() => {
    onReset()
    sendRecording()
  }, [sendRecording, onReset])

  const onPanFinalize = React.useCallback(
    (success: boolean, panLocked: boolean) => {
      // cancelled
      if (!panEnabled) {
        onCancelRecording()
        return
      }

      if (!success) {
        flashTip()
        return
      }

      setLocked(panLocked)
      if (!panLocked) {
        sendRecording()
        setVisible(Visible.START_HIDDEN)
      }
    },
    [flashTip, onCancelRecording, setVisible, panEnabled, sendRecording]
  )

  const onPanStart = React.useCallback(() => {
    startRecording()
    setVisible(Visible.SHOW)
  }, [startRecording, setVisible])
  const onPanCancel = React.useCallback(() => {
    setPanEnabled(false)
  }, [])
  const maxCancelDrift = -120
  const maxLockDrift = -100
  const startedSV = useSharedValue(0)
  const panGesture = Gesture.Pan()
    .minDistance(0)
    .minPointers(1)
    .maxPointers(1)
    .activateAfterLongPress(200)
    .onStart(() => {
      // we get this multiple times for some reason
      if (startedSV.value) {
        return
      }

      startedSV.value = 1
      runOnJS(onPanStart)()
    })
    .onFinalize((_e, success) => {
      startedSV.value = 0
      runOnJS(onPanFinalize)(success, lockedSV.value === 1)
    })
    .onUpdate(e => {
      if (lockedSV.value) {
        return
      }
      dragYSV.value = interpolate(e.translationY, [maxLockDrift, 0], [maxLockDrift, 0], Extrapolation.CLAMP)
      dragXSV.value = interpolate(
        e.translationX,
        [maxCancelDrift, 0],
        [maxCancelDrift, 0],
        Extrapolation.CLAMP
      )

      if (e.translationX < maxCancelDrift) {
        runOnJS(onPanCancel)()
      } else if (e.translationY < maxLockDrift) {
        lockedSV.value = 1
        runOnJS(setLocked)(true)
      }
    })
    .enabled(panEnabled)
  const gesture = panGesture
  const icon = (
    <View>
      <GestureDetector gesture={gesture}>
        <Kb.Icon type="iconfont-mic" style={styles.iconStyle} />
      </GestureDetector>
    </View>
  )

  const fadeSV = useSharedValue(0)
  React.useEffect(() => {
    switch (visible) {
      case Visible.SHOW:
        fadeSV.value = withSpring(1)
        break
      case Visible.START_HIDDEN:
        fadeSV.value = withTiming(0, {duration: 200}, () => {
          // hide after we're done animating
          runOnJS(setVisible)(Visible.HIDDEN)
        })
        break
      default:
    }
    dragXSV.value = withTiming(0)
    dragYSV.value = withTiming(0)
  }, [fadeSV, setVisible, dragXSV, dragYSV, visible])
  const overlay =
    visible === Visible.HIDDEN ? null : (
      <Portal hostName="convOverlay">
        <Animated.View style={styles.container} pointerEvents="box-none">
          <BigBackground fadeSV={fadeSV} />
          <AmpCircle fadeSV={fadeSV} ampSV={ampSV} dragXSV={dragXSV} dragYSV={dragYSV} lockedSV={lockedSV} />
          <InnerCircle
            fadeSV={fadeSV}
            dragXSV={dragXSV}
            dragYSV={dragYSV}
            locked={locked}
            lockedSV={lockedSV}
            stageRecording={onStageRecording}
          />
          <LockHint fadeSV={fadeSV} dragXSV={dragXSV} dragYSV={dragYSV} lockedSV={lockedSV} />
          <CancelHint
            onCancel={onCancelRecording}
            fadeSV={fadeSV}
            locked={locked}
            lockedSV={lockedSV}
            dragXSV={dragXSV}
          />
          <SendRecordingButton fadeSV={fadeSV} lockedSV={lockedSV} sendRecording={onSendRecording} />
          <AudioCounter fadeSV={fadeSV} />
        </Animated.View>
      </Portal>
    )

  return {icon, overlay}
}

const vibrate = (short: boolean) => {
  if (short) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      .then(() => {})
      .catch(() => {})
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      .then(() => {})
      .catch(() => {})
  }
}

const makeRecorder = async (onRecordingStatusUpdate: (s: Audio.RecordingStatus) => void) => {
  console.log('aaa making recorder')
  vibrate(true)

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    playThroughEarpieceAndroid: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: false,
    staysActiveInBackground: false,
  })
  const recording = new Audio.Recording()
  await recording.prepareToRecordAsync({
    android: {
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      bitRate: 32000,
      extension: '.m4a',
      numberOfChannels: 1,
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      sampleRate: 22050,
    },
    ios: {
      audioQuality: Audio.IOSAudioQuality.MIN,
      bitRate: 32000,
      extension: '.m4a',
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
      numberOfChannels: 1,
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      sampleRate: 22050,
    },
    isMeteringEnabled: true,
    web: {},
  })
  recording.setProgressUpdateInterval(100)
  recording.setOnRecordingStatusUpdate(onRecordingStatusUpdate)
  console.log('aaa making recorder success')
  return recording
}

// Hook for interfacing with the native recorder
const useRecorder = (p: {
  conversationIDKey: Types.ConversationIDKey
  ampSV: SVN
  setShowAudioSend: (s: boolean) => void
  showAudioSend: boolean
}) => {
  const {conversationIDKey, ampSV, setShowAudioSend, showAudioSend} = p
  const recordingRef = React.useRef<Audio.Recording | undefined>()
  const recordStartRef = React.useRef(0)
  const recordEndRef = React.useRef(0)
  const pathRef = React.useRef('')
  const dispatch = Container.useDispatch()
  const ampTracker = React.useRef(new AmpTracker()).current
  const [staged, setStaged] = React.useState(false)

  const stopRecording = React.useCallback(async () => {
    recordEndRef.current = Date.now()
    const recording = recordingRef.current
    if (recording) {
      console.log('aaa recording no updates')
      recording.setOnRecordingStatusUpdate(null)
      try {
        console.log('aaa recording STOP')
        await recording.stopAndUnloadAsync()
      } catch (e) {
        console.log('Recoding stopping fail', e)
      } finally {
        recordingRef.current = undefined
      }
    }
  }, [])

  const onReset = React.useCallback(
    async (why: string) => {
      console.log('aaa everything reset', why)
      try {
        await stopRecording()
      } catch {}
      ampTracker.reset()
      if (pathRef.current) {
        try {
          await FileSystem.deleteAsync(pathRef.current, {idempotent: true})
        } catch {}
        pathRef.current = ''
      }
      recordStartRef.current = 0
      recordEndRef.current = 0
      setStaged(false)
      setShowAudioSend(false)
      console.log('aaa everything reset done')
    },
    [setStaged, ampTracker, stopRecording, setShowAudioSend]
  )

  const startRecording = React.useCallback(() => {
    console.log('aaa start recording')
    // calls of this never handle the promise so just handle it here
    const checkPerms = async () => {
      try {
        let {status} = await Audio.getPermissionsAsync()
        if (status === Audio.PermissionStatus.UNDETERMINED) {
          const askRes = await Audio.requestPermissionsAsync()
          status = askRes.status
        }
        if (status === Audio.PermissionStatus.DENIED) {
          throw new Error('Please allow Keybase to access the microphone in the phone settings.')
        }
        return true
      } catch (_error) {
        const error = _error as {message: string}
        logger.info('failed to get audio perms: ' + error.message)
        dispatch(
          Chat2Gen.createSetCommandStatusInfo({
            conversationIDKey,
            info: {
              actions: [RPCChatTypes.UICommandStatusActionTyp.appsettings],
              displayText: `Failed to access audio. ${error.message}`,
              displayType: RPCChatTypes.UICommandStatusDisplayTyp.error,
            },
          })
        )
      }
      return false
    }
    const impl = async () => {
      await onReset('about to record')
      const goodPerms = await checkPerms()
      if (!goodPerms) {
        throw new Error("Couldn't get audio permissions")
      }

      const onRecordingStatusUpdate = (status: Audio.RecordingStatus) => {
        const inamp = status.metering
        if (inamp === undefined) {
          return
        }
        const amp = 10 ** (inamp * 0.05)
        ampTracker.addAmp(amp)
        const maxScale = 8
        const minScale = 3
        ampSV.value = withTiming(minScale + amp * (maxScale - minScale), {duration: 100})
      }

      const recording = await makeRecorder(onRecordingStatusUpdate)
      const audioPath = recording.getURI()?.substring('file://'.length)
      if (!audioPath) {
        throw new Error("Couldn't start audio recording")
      }
      pathRef.current = audioPath
      console.log('aaa old recording', recordingRef.current)
      recordingRef.current = recording

      console.log('aaa recording start async')
      await recording.startAsync()
      console.log('aaa recording start async success')
      recordStartRef.current = Date.now()
      recordEndRef.current = recordStartRef.current
    }
    impl()
      .then(() => {})
      .catch(e => {
        console.log('aaa start failed', e)
        onReset('record exception')
          .then(() => {})
          .catch(() => {})
      })
    return
  }, [ampTracker, conversationIDKey, dispatch, onReset, ampSV])

  const sendRecording = React.useCallback(() => {
    const impl = async () => {
      console.log('aaa sendrecording')
      await stopRecording()
      vibrate(false)
      const duration = (recordEndRef.current || recordStartRef.current) - recordStartRef.current
      const path = pathRef.current
      const amps = ampTracker.getBucketedAmps(duration)
      if (duration > 500 && path && amps.length) {
        dispatch(
          Chat2Gen.createSendAudioRecording({
            amps,
            conversationIDKey,
            duration,
            path,
          })
        )
      } else {
        console.log('aaa bail on too short or not path', duration, path, amps)
      }
      await onReset('done sending, clean reset')
    }
    impl()
      .then(() => {})
      .catch(() => {})
  }, [dispatch, conversationIDKey, ampTracker, onReset, stopRecording])

  const cancelRecording = React.useCallback(() => {
    console.log('aaa cancel recording')
    onReset('cancel recording')
      .then(() => {})
      .catch(() => {})
  }, [onReset])

  const audioSend = showAudioSend ? (
    <AudioSend
      ampTracker={ampTracker}
      cancelRecording={cancelRecording}
      duration={(recordEndRef.current || recordStartRef.current) - recordStartRef.current}
      path={pathRef.current}
      sendRecording={sendRecording}
    />
  ) : null

  const stageRecording = React.useCallback(() => {
    const impl = async () => {
      console.log('aaa stage recording')
      await stopRecording()
      setStaged(true)
      setShowAudioSend(true)
    }
    impl()
      .then(() => {})
      .catch(() => {})
  }, [stopRecording, setStaged, setShowAudioSend])

  // on unmount cleanup
  React.useEffect(() => {
    console.log('aaaa useefect onreset mount')
    return () => {
      console.log('aaaa useefect onreset UNmount')
      setShowAudioSend(false)
      onReset('unmount')
        .then(() => {})
        .catch(() => {})
    }
  }, [onReset, setShowAudioSend])

  React.useEffect(() => {
    console.log('aaaa useefect CLEAN mount')
    return () => {
      console.log('aaaa useefect CLEAN UNmount')
    }
  }, [])

  return {audioSend, cancelRecording, sendRecording, stageRecording, staged, startRecording}
}

const AudioRecorder = React.memo(function AudioRecorder(props: Props) {
  const {conversationIDKey, setShowAudioSend, showAudioSend} = props
  const ampSV = useSharedValue(0)

  const {startRecording, cancelRecording, sendRecording, stageRecording, audioSend} = useRecorder({
    ampSV,
    conversationIDKey,
    setShowAudioSend,
    showAudioSend,
  })
  const {tooltip, flashTip} = useTooltip()
  const {icon, overlay} = useIconAndOverlay({
    ampSV,
    cancelRecording,
    flashTip,
    sendRecording,
    stageRecording,
    startRecording,
  })

  console.log('aaaa render recorder audio send', audioSend)

  return (
    <>
      {tooltip}
      {audioSend}
      {icon}
      {overlay}
    </>
  )
})

const BigBackground = (props: {fadeSV: SVN}) => {
  const {fadeSV} = props
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeSV.value * 0.9,
    transform: [{scale: fadeSV.value}],
  }))
  return <Animated.View pointerEvents="box-none" style={[styles.bigBackgroundStyle, animatedStyle]} />
}

const AmpCircle = (props: {ampSV: SVN; dragXSV: SVN; dragYSV: SVN; fadeSV: SVN; lockedSV: SVN}) => {
  const {ampSV, dragXSV, dragYSV, fadeSV, lockedSV} = props
  const animatedStyle = useAnimatedStyle(() => {
    const dragDistanceX = -50
    const dragXOpacity =
      dragYSV.value < -10 ? 1 : interpolate(dragXSV.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
    return {
      backgroundColor: interpolateColor(
        lockedSV.value,
        [0, 1],
        [colors.blueLighterOrBlueLight, colors.redLight]
      ),
      opacity: withTiming(dragXOpacity),
      transform: [{translateY: lockedSV.value ? 0 : dragYSV.value}, {scale: ampSV.value * fadeSV.value}],
    }
  })
  return <Animated.View style={[styles.ampCircleStyle, animatedStyle]} />
}

const InnerCircle = (props: {
  dragXSV: SVN
  dragYSV: SVN
  fadeSV: SVN
  lockedSV: SVN
  locked: boolean
  stageRecording: () => void
}) => {
  const {dragXSV, dragYSV, fadeSV, locked, lockedSV, stageRecording} = props
  const circleStyle = useAnimatedStyle(() => {
    // worklet needs this locally for some reason
    const dragDistanceX = -50
    const dragXOpacity =
      dragYSV.value < -10 ? 1 : interpolate(dragXSV.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
    return {
      backgroundColor: interpolateColor(lockedSV.value, [0, 1], [colors.blue, colors.red]),
      opacity: withTiming(dragXOpacity),
      transform: [{translateY: lockedSV.value ? 0 : dragYSV.value}, {scale: fadeSV.value}],
    }
  })
  return (
    <Animated.View style={[styles.innerCircleStyle, circleStyle]}>
      {locked ? (
        <AnimatedIcon
          type="iconfont-stop"
          color={Styles.globalColors.whiteOrWhite}
          onClick={stageRecording}
        />
      ) : null}
    </Animated.View>
  )
}

const LockHint = (props: {fadeSV: SVN; lockedSV: SVN; dragXSV: SVN; dragYSV: SVN}) => {
  const {lockedSV, fadeSV, dragXSV, dragYSV} = props
  const slideAmount = 150
  const spaceBetween = 20
  const deltaY = 50
  const arrowStyle = useAnimatedStyle(() => {
    // worklet needs this locally for some reason
    const dragDistanceX = -50
    const dragXOpacity =
      dragYSV.value < -10 ? 1 : interpolate(dragXSV.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
    return {
      opacity: lockedSV.value
        ? withTiming(0)
        : fadeSV.value *
          interpolate(dragYSV.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP) *
          dragXOpacity,
      transform: [{translateX: 10}, {translateY: deltaY - fadeSV.value * slideAmount}],
    }
  })
  const lockStyle = useAnimatedStyle(() => {
    // worklet needs this locally for some reason
    const dragDistanceX = -50
    const dragXOpacity =
      dragYSV.value < -10 ? 1 : interpolate(dragXSV.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)

    return {
      opacity: lockedSV.value ? withTiming(0) : fadeSV.value * dragXOpacity,
      transform: [
        {translateX: 5},
        {
          translateY:
            deltaY +
            spaceBetween -
            fadeSV.value * slideAmount -
            interpolate(dragYSV.value, [dragDistanceX, 0], [spaceBetween, 0], Extrapolation.CLAMP),
        },
      ],
    }
  })
  return (
    <>
      <AnimatedIcon type="iconfont-arrow-up" sizeType="Tiny" style={[styles.lockHintStyle, arrowStyle]} />
      <AnimatedIcon type="iconfont-lock" style={[styles.lockHintStyle, lockStyle]} />
    </>
  )
}

const AnimatedIcon = Animated.createAnimatedComponent(Kb.Icon)
const AnimatedText = Animated.createAnimatedComponent(Kb.Text)

const CancelHint = (props: {
  fadeSV: SVN
  dragXSV: SVN
  locked: boolean
  lockedSV: SVN
  onCancel: () => void
}) => {
  const {locked, lockedSV, fadeSV, onCancel, dragXSV} = props
  const arrowStyle = useAnimatedStyle(() => {
    // copy paste so we don't share as many vars between jsc contexts
    const dragDistanceX = -50
    const deltaX = 180
    const slideAmount = 220
    const spaceBetween = 20
    return {
      opacity: lockedSV.value
        ? withTiming(0)
        : fadeSV.value * interpolate(dragXSV.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP),
      transform: [{translateX: deltaX - spaceBetween - fadeSV.value * slideAmount}, {translateY: -4}],
    }
  })
  const closeStyle = useAnimatedStyle(() => {
    const dragDistanceX = -50
    const deltaX = 180
    const slideAmount = 220
    const spaceBetween = 20
    return {
      opacity: lockedSV.value
        ? withTiming(0)
        : fadeSV.value * interpolate(dragXSV.value, [dragDistanceX, 0], [1, 0], Extrapolation.CLAMP),
      transform: [{translateX: deltaX - spaceBetween - fadeSV.value * slideAmount}, {translateY: -4}],
    }
  })
  const textStyle = useAnimatedStyle(() => {
    const dragDistanceX = -50
    const deltaX = 180
    const slideAmount = 220
    return {
      opacity: fadeSV.value,
      transform: [
        {
          translateX:
            deltaX -
            fadeSV.value * slideAmount -
            interpolate(dragXSV.value, [dragDistanceX, 0], [8, 0], Extrapolation.CLAMP),
        },
      ],
    }
  })

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

const SendRecordingButton = (props: {fadeSV: SVN; lockedSV: SVN; sendRecording: () => void}) => {
  const {fadeSV, lockedSV, sendRecording} = props
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: lockedSV.value ? fadeSV.value : withTiming(0),
    transform: [{translateY: withTiming(lockedSV.value ? -100 : 50)}],
  }))
  return (
    <Animated.View style={[styles.sendRecordingButtonStyle, buttonStyle]}>
      <Kb.Icon
        padding="tiny"
        color={Styles.globalColors.whiteOrWhite}
        onClick={sendRecording}
        sizeType="Small"
        type="iconfont-arrow-full-up"
      />
    </Animated.View>
  )
}

const AudioCounter = (props: {fadeSV: SVN}) => {
  const {fadeSV} = props
  const [seconds, setSeconds] = React.useState(0)
  const startTime = React.useRef(Date.now()).current
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSeconds((Date.now() - startTime) / 1000)
    }, 1000)
    return () => clearTimeout(timer)
  }, [seconds, startTime])
  const durationStyle = useAnimatedStyle(() => ({
    opacity: fadeSV.value,
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
  iconStyle: {padding: Styles.globalMargins.tiny},
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
  tooltipContainer: {
    backgroundColor: Styles.globalColors.black,
    borderRadius: Styles.borderRadius,
    bottom: 45,
    padding: Styles.globalMargins.tiny,
    position: 'absolute',
    right: 20,
  },
}))

export default AudioRecorder
