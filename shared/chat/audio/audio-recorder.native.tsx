import * as Chat2Gen from '../../actions/chat2-gen'
import * as Constants from '../../constants/chat2'
import * as Container from '../../util/container'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Kb from '../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/chat2'
import Animated, {
  Extrapolation,
  interpolate,
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
import {View, Vibration} from 'react-native'
import {formatAudioRecordDuration} from '../../util/timestamp'
import {Audio, InterruptionModeIOS, InterruptionModeAndroid} from 'expo-av'
import logger from '../../logger'
import * as Haptics from 'expo-haptics'
import * as FileSystem from 'expo-file-system'
import AudioSend, {ShowAudioSendContext} from './audio-send'

type SVN = SharedValue<number>

type Props = {
  conversationIDKey: Types.ConversationIDKey
}

const makeAudioRecordingInfo = (): Types.AudioRecordingInfo => ({
  isLocked: false,
  outboxID: new Buffer('hex'),
  path: '',
  recordStart: Date.now(),
  status: Types.AudioRecordingStatus.INITIAL,
})

const showAudioRecording = (audioRecording: Types.AudioRecordingInfo | undefined) => {
  return !(
    !audioRecording ||
    audioRecording.status === Types.AudioRecordingStatus.INITIAL ||
    audioRecording.status === Types.AudioRecordingStatus.STOPPED ||
    audioRecording.status === Types.AudioRecordingStatus.STAGED ||
    audioRecording.status === Types.AudioRecordingStatus.CANCELLED
  )
}

const isStoppedAudioRecordingStatus = (status: Types.AudioRecordingStatus) => {
  return (
    status === Types.AudioRecordingStatus.STOPPED ||
    status === Types.AudioRecordingStatus.STAGED ||
    status === Types.AudioRecordingStatus.CANCELLED
  )
}

const isCancelledAudioRecording = (audioRecording: Types.AudioRecordingInfo | undefined) => {
  return !!audioRecording && audioRecording.status === Types.AudioRecordingStatus.CANCELLED
}

const useRecording = (conversationIDKey: Types.ConversationIDKey, setVisible: (v: Visible) => void) => {
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

  const recordingRef = React.useRef<Audio.Recording | undefined>()
  const audioInfoRef = React.useRef<Types.AudioRecordingInfo | undefined>()

  const onSetAudioRecordingPostInfo = React.useCallback(
    async (outboxID: Buffer, path: string) => {
      const audio = audioInfoRef.current
      const info = audioInfoRef.current
      if (info?.status === Types.AudioRecordingStatus.INITIAL) {
        info.outboxID = outboxID
        info.path = path
        info.status = Types.AudioRecordingStatus.RECORDING
      }

      if (!audio || audio.status !== Types.AudioRecordingStatus.RECORDING) {
        logger.info('onSetAudioRecordingPostInfo: not in recording mode anymore, bailing')
        return
      }

      const recording = recordingRef.current
      await recording?.startAsync()
    },
    [audioInfoRef]
  )

  const onEnableAudioRecording = React.useCallback(async () => {
    audioInfoRef.current = makeAudioRecordingInfo()
    const audio = audioInfoRef.current
    const oldRecording = recordingRef.current
    if (!audio || isCancelledAudioRecording(audio)) {
      logger.info('enableAudioRecording: no recording info set, bailing')
      return
    }

    if (Container.isIOS) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } else {
      Vibration.vibrate(50)
    }
    const outboxID = Constants.generateOutboxID()
    if (oldRecording) {
      try {
        oldRecording.setOnRecordingStatusUpdate(null)
      } catch {}
      try {
        await oldRecording.stopAndUnloadAsync()
      } catch {}
      recordingRef.current = undefined
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playThroughEarpieceAndroid: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      staysActiveInBackground: false,
    })
    const r = new Audio.Recording()
    await r.prepareToRecordAsync({
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
    const audioPath = r.getURI()?.substring('file://'.length)
    if (!audioPath) {
      throw new Error("Couldn't start audio recording")
    }
    recordingRef.current = r
    const recording = r
    recording.setProgressUpdateInterval(100)
    recording.setOnRecordingStatusUpdate((status: Audio.RecordingStatus) => {
      status.metering !== undefined && meteringCb(status.metering)
    })
    logger.info('onEnableAudioRecording: setting recording info')
    await onSetAudioRecordingPostInfo(outboxID, audioPath)
  }, [onSetAudioRecordingPostInfo, meteringCb, audioInfoRef])

  const onAttemptAudioRecording = React.useCallback(async () => {
    let chargeForward = true
    try {
      let {status} = await Audio.getPermissionsAsync()
      if (status === Audio.PermissionStatus.UNDETERMINED) {
        const askRes = await Audio.requestPermissionsAsync()
        status = askRes.status
        chargeForward = false
      }
      if (status === Audio.PermissionStatus.DENIED) {
        throw new Error('Please allow Keybase to access the microphone in the phone settings.')
      }
    } catch (_error) {
      const error = _error as any
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
      return
    }
    if (chargeForward) {
      await onEnableAudioRecording()
    }
  }, [dispatch, conversationIDKey, onEnableAudioRecording])

  const enableRecording = React.useCallback(async () => {
    setVisible(Visible.SHOW)
    ampTracker.reset()
    await onAttemptAudioRecording()
  }, [ampTracker, onAttemptAudioRecording, setVisible])

  const onSendAudioRecording = React.useCallback(
    async (fromStaged: boolean) => {
      recordingRef.current = undefined
      if (!fromStaged) {
        if (Container.isIOS) {
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          } catch {}
        } else {
          Vibration.vibrate(50)
        }
      }
      const info = audioInfoRef.current
      audioInfoRef.current = undefined
      if (info) {
        dispatch(Chat2Gen.createSendAudioRecording({conversationIDKey, fromStaged, info}))
      }
    },
    [dispatch, conversationIDKey, audioInfoRef]
  )

  const stopAudioRecordingAction = React.useCallback(
    async (stopType: Types.AudioStopType) => {
      const info = audioInfoRef.current
      if (info) {
        // don't do anything if we are recording and are in locked mode.
        if (showAudioRecording(info) && info.isLocked) {
          return
        }
      }
      logger.info('stopAudioRecording: stopping recording')
      const recording = recordingRef.current
      recording?.setOnRecordingStatusUpdate(null)
      try {
        await recording?.stopAndUnloadAsync()
      } catch (e) {
        console.log('Recoding stopping fail', e)
      } finally {
        recordingRef.current = undefined
      }

      if (!info) {
        logger.info('stopAudioRecording: no audio record, not sending')
        return
      }

      let cancelRecord =
        info.status === Types.AudioRecordingStatus.CANCELLED || stopType === Types.AudioStopType.CANCEL
      if (Constants.audioRecordingDuration(info) < 500 || info.path.length === 0) {
        logger.info('stopAudioRecording: recording too short, skipping')
        cancelRecord = true
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }

      if (cancelRecord) {
        logger.info('stopAudioRecording: recording cancelled, bailing out')
        try {
          if (info.path) {
            await FileSystem.deleteAsync(info.path, {idempotent: true})
          }
        } catch (e) {
          console.log('Recording delete failed', e)
        }
        return
      }

      if (info.status === Types.AudioRecordingStatus.STAGED) {
        logger.info('stopAudioRecording: in staged mode, not sending')
        return
      }
      await onSendAudioRecording(false)
    },
    [onSendAudioRecording, audioInfoRef]
  )

  const stopAudioRecordingReducer = React.useCallback(
    (stopType: Types.AudioStopType) => {
      const info = audioInfoRef.current
      if (!info) {
        return
      }
      let nextStatus: Types.AudioRecordingStatus = info.status
      if (nextStatus === Types.AudioRecordingStatus.CANCELLED) {
        return
      }
      let nextPath = info.path
      if (info.isLocked) {
        switch (stopType) {
          case Types.AudioStopType.CANCEL:
            nextStatus = Types.AudioRecordingStatus.CANCELLED
            nextPath = ''
            break
          case Types.AudioStopType.SEND:
            nextStatus = Types.AudioRecordingStatus.STOPPED
            break
          case Types.AudioStopType.STOPBUTTON:
            nextStatus = Types.AudioRecordingStatus.STAGED
            break
          case Types.AudioStopType.RELEASE:
            break
        }
      } else {
        switch (stopType) {
          case Types.AudioStopType.CANCEL:
            nextStatus = Types.AudioRecordingStatus.CANCELLED
            nextPath = ''
            break
          default:
            nextStatus = Types.AudioRecordingStatus.STOPPED
        }
      }
      info.amps = ampTracker
      info.path = nextPath
      info.recordEnd = isStoppedAudioRecordingStatus(nextStatus) ? Date.now() : undefined
      info.status = nextStatus
      info.isLocked = false
    },
    [ampTracker, audioInfoRef]
  )

  const stopRecording = React.useCallback(
    async (stopType: Types.AudioStopType) => {
      setVisible(Visible.START_HIDDEN)
      stopAudioRecordingReducer(stopType)
      await stopAudioRecordingAction(stopType)
    },
    [stopAudioRecordingReducer, stopAudioRecordingAction, setVisible]
  )

  const lockRecording = React.useCallback(() => {
    const info = audioInfoRef.current
    if (info) {
      info.isLocked = true
    }
  }, [audioInfoRef])

  // on unmount stop
  React.useEffect(() => {
    return () => {
      stopRecording(Types.AudioStopType.CANCEL)
        .then(() => {})
        .catch(() => {})
    }
  }, [stopRecording])

  return {
    ampScale,
    audioInfoRef,
    enableRecording,
    lockRecording,
    onSendAudioRecording,
    stopRecording,
  }
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

// pulled out to not scope too much in closure
const makeTapTimeout = (
  stillGesturingRef: React.MutableRefObject<boolean>,
  enableRecording: () => Promise<void>,
  setShowToolTip: (s: boolean) => void
) => {
  return setTimeout(() => {
    if (stillGesturingRef.current) {
      enableRecording()
        .then(() => {})
        .catch(() => {})
    } else {
      setShowToolTip(true)
    }
  }, 100)
}

enum Visible {
  HIDDEN,
  START_HIDDEN,
  SHOW,
}

const AudioRecorder = React.memo(function AudioRecorder(props: Props) {
  const {conversationIDKey} = props
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  // don't set it immediately
  const [visible, setVisible] = React.useState(Visible.HIDDEN)
  const {ampScale, audioInfoRef, enableRecording, stopRecording, lockRecording, onSendAudioRecording} =
    useRecording(conversationIDKey, setVisible)
  const audioRecording = audioInfoRef.current

  const initialBounce = useSharedValue(0)

  React.useEffect(() => {
    initialBounce.value =
      visible === Visible.SHOW
        ? withSpring(1)
        : withTiming(0, {duration: 200}, () => {
            // hide after we're done animating
            runOnJS(setVisible)(Visible.HIDDEN)
          })

    dragX.value = withTiming(0)
    dragY.value = withTiming(0)
  }, [initialBounce, setVisible, dragX, dragY, visible])

  const locked = audioRecording?.isLocked ?? false
  const onCancel = React.useCallback(async () => {
    await stopRecording(Types.AudioStopType.CANCEL)
  }, [stopRecording])

  const [showToolTip, setShowToolTip] = React.useState(false)

  const {showAudioSend, setShowAudioSend} = React.useContext(ShowAudioSendContext)

  const onHideTooltip = React.useCallback(() => {
    setShowToolTip(false)
  }, [])
  const stillGesturingRef = React.useRef(false)
  const tapStartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => {
    return () => {
      tapStartTimerRef.current && clearTimeout(tapStartTimerRef.current)
      tapStartTimerRef.current = null
    }
  }, [])
  // after the initial tap see if we're still gesturing. if so we start to record, if not we show the tooltip

  const onTapStart = React.useCallback(() => {
    stillGesturingRef.current = true
    tapStartTimerRef.current = makeTapTimeout(stillGesturingRef, enableRecording, setShowToolTip)
  }, [enableRecording, setShowToolTip, stillGesturingRef])

  const onTapEnd = React.useCallback(async () => {
    stillGesturingRef.current = false
    // we're locked, ignore the tap
    if (!locked) {
      await stopRecording(Types.AudioStopType.RELEASE)
    }
  }, [stopRecording, locked, stillGesturingRef])

  const tapStart = useSharedValue(0)
  const translationX = useSharedValue(0)
  const translationY = useSharedValue(0)
  const tapGesture = Gesture.Tap()
    .maxDuration(Number.MAX_SAFE_INTEGER)
    .shouldCancelWhenOutside(false)
    .onBegin(() => {
      // mark the time
      tapStart.value = Date.now()
      // start the timer, when the timer fires we start recording
      runOnJS(onTapStart)()
    })
    .onEnd(() => {
      runOnJS(onTapEnd)()
    })
    .enabled(!locked)

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
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
    .enabled(!locked)
  const composedGesture = Gesture.Simultaneous(tapGesture, panGesture)

  // const showAudioSend = !!audio && audio.status === Types.AudioRecordingStatus.STAGED
  const audioSend =
    audioInfoRef.current?.status === Types.AudioRecordingStatus.STAGED ? (
      <AudioSend
        audioInfoRef={audioInfoRef}
        stopRecording={stopRecording}
        sendAudioRecording={onSendAudioRecording}
      />
    ) : null

  // update context so the input can show it
  if (!!audioSend !== showAudioSend) {
    setShowAudioSend(!!audioSend)
  }

  console.log('aaa render audio reocrder', {
    audioSend,
    locked,
    showToolTip,
    visible,
  })

  return (
    <>
      {showToolTip && (
        <Portal hostName="convOverlay">
          <Tooltip onHide={onHideTooltip} />
        </Portal>
      )}
      {audioSend ? <Portal hostName="audioSend">{audioSend}</Portal> : null}
      <View>
        <GestureDetector gesture={composedGesture}>
          <Kb.Icon type="iconfont-mic" style={styles.iconStyle} />
        </GestureDetector>
      </View>
      <Portal hostName="convOverlay">
        {visible === Visible.HIDDEN ? null : (
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
})

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
    const dragXOpacity =
      dragY.value < -10 ? 1 : interpolate(dragX.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
    return {
      opacity: withTiming(dragXOpacity),
      transform: [{translateY: locked ? 0 : dragY.value}, {scale: ampScale.value * initialBounce.value}],
    }
  })
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
    const dragXOpacity =
      dragY.value < -10 ? 1 : interpolate(dragX.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
    return {
      opacity: withTiming(dragXOpacity),
      transform: [{translateY: locked ? 0 : dragY.value}, {scale: initialBounce.value}],
    }
  })
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
    const dragXOpacity =
      dragY.value < -10 ? 1 : interpolate(dragX.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
    return {
      opacity: locked
        ? withTiming(0)
        : initialBounce.value *
          interpolate(dragY.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP) *
          dragXOpacity,
      transform: [{translateX: 10}, {translateY: deltaY - initialBounce.value * slideAmount}],
    }
  })
  const lockStyle = useAnimatedStyle(() => {
    // worklet needs this locally for some reason
    const dragDistanceX = -50
    const dragXOpacity =
      dragY.value < -10 ? 1 : interpolate(dragX.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)

    return {
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
