import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {Portal} from '@/common-adapters/portal.native'
import * as React from 'react'
import * as InputState from '@/chat/conversation/input-area/input-state'
// we need to use the raw colors to animate
import {colors} from '@/styles/colors'
import * as Reanimated from 'react-native-reanimated'
import {AmpTracker} from './amptracker'
import {PanResponder, View, type GestureResponderEvent, type PanResponderGestureState} from 'react-native'
import {formatAudioRecordDuration} from '@/util/timestamp'
import {AudioModule, AudioQuality, IOSOutputFormat} from 'expo-audio'
import {setupAudioMode} from '@/util/audio.native'
import logger from '@/logger'
import * as Haptics from 'expo-haptics'
import {File} from 'expo-file-system'
import AudioSend from './audio-send.native'
import {useConversationSendActions} from '@/chat/conversation/send-actions'

const {useSharedValue, Extrapolation, useAnimatedStyle} = Reanimated
const {interpolate, withSequence, withSpring, runOnJS} = Reanimated
const {useAnimatedReaction, withDelay, withTiming, interpolateColor, default: Animated} = Reanimated
const AnimatedBox2 = Animated.createAnimatedComponent(Kb.Box2)
type SVN = Reanimated.SharedValue<number>

type Props = {
  showAudioSend: boolean
  setShowAudioSend: (s: boolean) => void
}

enum Visible {
  HIDDEN,
  START_HIDDEN,
  SHOW,
}

const useTooltip = () => {
  'use no memo'
  const [showTooltip, setShowTooltip] = React.useState(false)
  const lastShowTooltipRef = React.useRef(showTooltip)
  const opacitySV = useSharedValue(0)
  const animatedStyles = useAnimatedStyle(() => {
    return {opacity: opacitySV.value}
  })

  React.useEffect(() => {
    if (showTooltip === lastShowTooltipRef.current) return
    lastShowTooltipRef.current = showTooltip
    if (showTooltip) {
      opacitySV.set(
        withSequence(withTiming(1, {duration: 200}), withDelay(1000, withTiming(0, {duration: 200})))
      )

      const id = setTimeout(() => {
        setShowTooltip(false)
      }, 1400)
      return () => {
        clearTimeout(id)
      }
    }
    return undefined
  }, [showTooltip, opacitySV])

  const tooltip = showTooltip ? (
    <Portal hostName="convOverlay" useFullScreenOverlay={false}>
      <Animated.View style={animatedStyles}>
        <Kb.Box2 direction="horizontal" style={styles.tooltipContainer}>
          <Kb.Text type="BodySmall" negative={true}>
            Hold to record audio.
          </Kb.Text>
        </Kb.Box2>
      </Animated.View>
    </Portal>
  ) : null

  const flashTip = () => {
    'worklet'
    runOnJS(setShowTooltip)(true)
  }

  return {flashTip, tooltip}
}

type MicButtonProps = {
  startedSV: SVN
  fadeSV: SVN
  canceledSV: SVN
  lockedSV: SVN
  dragXSV: SVN
  dragYSV: SVN
  startRecording: () => void
  onCancelRecording: () => void
  onFlashTip: () => void
  sendRecording: () => void
  onReset: () => void
}

const MicButton = (p: MicButtonProps) => {
  'use no memo'
  const {startedSV, fadeSV, canceledSV, lockedSV, dragXSV, dragYSV,
    startRecording, onCancelRecording, onFlashTip, sendRecording, onReset} = p

  const panStartRef = React.useRef(0)
  const overlayTimeoutIdRef = React.useRef(0)
  const cbRef = React.useRef({onCancelRecording, onFlashTip, sendRecording, onReset, startRecording})

  // useState factory captures only plain mutable locals — no React refs transitively.
  // We swap them out from useLayoutEffect, which is not subject to render-phase lint rules.
  const [ctx] = React.useState(() => {
    let _grant = () => {}
    let _move = (_e: GestureResponderEvent, _gs: PanResponderGestureState) => {}
    let _release = () => {}
    let _terminate = () => {}
    return {
      panHandlers: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => _grant(),
        onPanResponderMove: (e, gs) => _move(e, gs),
        onPanResponderRelease: () => _release(),
        onPanResponderTerminate: () => _terminate(),
      }).panHandlers,
      set(
        grant: () => void,
        move: (e: GestureResponderEvent, gs: PanResponderGestureState) => void,
        release: () => void,
        terminate: () => void,
      ) {
        _grant = grant
        _move = move
        _release = release
        _terminate = terminate
      },
    }
  })

  // All ref/SharedValue accesses live here — useLayoutEffect is post-render, not during render.
  React.useLayoutEffect(() => {
    cbRef.current = {onCancelRecording, onFlashTip, sendRecording, onReset, startRecording}
    ctx.set(
      () => {
        overlayTimeoutIdRef.current = setTimeout(() => {
          if (startedSV.value) return
          startedSV.set(1)
          fadeSV.set(withSpring(1, {duration: 200}))
          cbRef.current.startRecording()
        }, 200) as unknown as number
        if (!panStartRef.current) panStartRef.current = Date.now()
      },
      (_e: GestureResponderEvent, gs: PanResponderGestureState) => {
        if (lockedSV.value || canceledSV.value) return
        const maxCancelDrift = -120
        const maxLockDrift = -100
        dragYSV.set(interpolate(gs.dy, [maxLockDrift, 0], [maxLockDrift, 0], Extrapolation.CLAMP))
        dragXSV.set(interpolate(gs.dx, [maxCancelDrift, 0], [maxCancelDrift, 0], Extrapolation.CLAMP))
        if (gs.dx < maxCancelDrift) canceledSV.set(1)
        else if (gs.dy < maxLockDrift) lockedSV.set(1)
      },
      () => {
        const diff = Date.now() - panStartRef.current
        startedSV.set(0)
        panStartRef.current = 0
        clearTimeout(overlayTimeoutIdRef.current)
        overlayTimeoutIdRef.current = 0
        const wasCancel = canceledSV.value === 1
        const panLocked = lockedSV.value === 1
        if (wasCancel) { cbRef.current.onCancelRecording(); return }
        if (diff < 200) { cbRef.current.onFlashTip(); return }
        if (!panLocked) { cbRef.current.sendRecording(); cbRef.current.onReset() }
      },
      () => {
        startedSV.set(0)
        panStartRef.current = 0
        clearTimeout(overlayTimeoutIdRef.current)
        overlayTimeoutIdRef.current = 0
        cbRef.current.onCancelRecording()
      },
    )
  })

  return (
    <View {...ctx.panHandlers}>
      <Kb.Icon type="iconfont-mic" style={styles.iconStyle} />
    </View>
  )
}

const useIconAndOverlay = (p: {
  flashTip: () => void
  startRecording: () => void
  sendRecording: () => void
  stageRecording: () => void
  cancelRecording: () => void
  ampSV: SVN
}) => {
  'use no memo'
  const {stageRecording, startRecording, sendRecording, cancelRecording, flashTip, ampSV} = p
  const [visible, setVisible] = React.useState(Visible.HIDDEN)

  // The input bar (and the mic icon) is lifted up by insets.bottom while the keyboard
  // is closed (KeyboardStickyView offset). Recording always happens keyboard-closed, so
  // shift the overlay up by the same amount to keep the circles centered on the mic.
  const insets = Kb.useSafeAreaInsets()

  const lockedSV = useSharedValue(0)
  const canceledSV = useSharedValue(0)
  const dragXSV = useSharedValue(0)
  const dragYSV = useSharedValue(0)
  const startedSV = useSharedValue(0)
  const fadeSV = useSharedValue(0)

  // so we don't keep calling setVisible
  const fadeSyncedSV = useSharedValue(0)
  useAnimatedReaction(
    () => fadeSV.value,
    (f: number) => {
      if (f === 0) {
        if (fadeSyncedSV.value !== 0) {
          fadeSyncedSV.set(0)
          runOnJS(setVisible)(Visible.HIDDEN)
        }
      } else if (fadeSyncedSV.value !== 1) {
        fadeSyncedSV.set(1)
        runOnJS(setVisible)(Visible.SHOW)
      }
    }
  )

  const onReset = () => {
    'worklet'
    fadeSV.set(withTiming(0, {duration: 200}))
    dragXSV.set(0)
    dragYSV.set(0)
    lockedSV.set(0)
    canceledSV.set(0)
  }

  const onCancelRecording = () => {
    onReset()
    cancelRecording()
  }

  const onStageRecording = () => {
    onReset()
    stageRecording()
  }

  const onSendRecording = () => {
    onReset()
    sendRecording()
  }

  const onFlashTip = () => {
    flashTip()
    onCancelRecording()
  }

  const icon = (
    <MicButton
      startedSV={startedSV}
      fadeSV={fadeSV}
      canceledSV={canceledSV}
      lockedSV={lockedSV}
      dragXSV={dragXSV}
      dragYSV={dragYSV}
      startRecording={startRecording}
      onCancelRecording={onCancelRecording}
      onFlashTip={onFlashTip}
      sendRecording={sendRecording}
      onReset={onReset}
    />
  )

  const durationStyle = useAnimatedStyle(() => ({
    opacity: fadeSV.value,
  }))

  const overlay =
    visible === Visible.HIDDEN ? null : (
      <Portal hostName="convOverlay" useFullScreenOverlay={false}>
        <Animated.View style={[styles.container, {bottom: insets.bottom}]} pointerEvents="box-none">
          <BigBackground fadeSV={fadeSV} />
          <AmpCircle fadeSV={fadeSV} ampSV={ampSV} dragXSV={dragXSV} dragYSV={dragYSV} lockedSV={lockedSV} />
          <InnerCircle
            fadeSV={fadeSV}
            dragXSV={dragXSV}
            dragYSV={dragYSV}
            lockedSV={lockedSV}
            stageRecording={onStageRecording}
          />
          <LockHint fadeSV={fadeSV} dragXSV={dragXSV} dragYSV={dragYSV} lockedSV={lockedSV} />
          <CancelHint onCancel={onCancelRecording} fadeSV={fadeSV} lockedSV={lockedSV} dragXSV={dragXSV} />
          <SendRecordingButton fadeSV={fadeSV} lockedSV={lockedSV} sendRecording={onSendRecording} />
          <Animated.View style={[styles.audioCounterStyle, durationStyle]}>
            <AudioCounter />
          </Animated.View>
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

const recordingOptions = {
  android: {
    audioEncoder: 'aac' as const,
    outputFormat: 'mpeg4' as const,
  },
  bitRate: 32000,
  extension: '.m4a',
  ios: {
    audioQuality: AudioQuality.MIN,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    outputFormat: IOSOutputFormat.MPEG4AAC,
  },
  isMeteringEnabled: true,
  numberOfChannels: 1,
  sampleRate: 22050,
  web: {},
}

const checkPerms = async (setCommandStatusInfo: (info?: T.Chat.CommandStatusInfo) => void) => {
  try {
    let {status} = await AudioModule.getRecordingPermissionsAsync()
    if (status === 'undetermined') {
      const askRes = await AudioModule.requestRecordingPermissionsAsync()
      status = askRes.status
    }
    if (status === 'denied') {
      throw new Error('Please allow Keybase to access the microphone in the phone settings.')
    }
    return true
  } catch (_error) {
    const error = _error as {message: string}
    logger.info('failed to get audio perms: ' + error.message)
    setCommandStatusInfo({
      actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
      displayText: `Failed to access audio. ${error.message}`,
      displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
    })
  }
  return false
}

// Hook for interfacing with the native recorder
const useRecorder = (p: {ampSV: SVN; setShowAudioSend: (s: boolean) => void; showAudioSend: boolean}) => {
  const {ampSV, setShowAudioSend, showAudioSend} = p
  const recordStartRef = React.useRef(0)
  const recordEndRef = React.useRef(0)
  const hasSetupRecording = React.useRef(false)
  const pathRef = React.useRef('')
  const [ampTracker] = React.useState(() => new AmpTracker())
  const [staged, setStaged] = React.useState(false)
  const [stagedRecording, setStagedRecording] = React.useState({duration: 0, path: ''})

  // Recorder is created lazily on startRecording and released on stop/reset/unmount.
  // This avoids holding a native SharedRef across unrelated navigations (e.g. photo picker).
  const recorderRef = React.useRef<InstanceType<typeof AudioModule.AudioRecorder> | null>(null)
  const meteringIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const releaseRecorder = React.useCallback(() => {
    if (meteringIntervalRef.current !== null) {
      clearInterval(meteringIntervalRef.current)
      meteringIntervalRef.current = null
    }
    if (recorderRef.current) {
      recorderRef.current.release()
      recorderRef.current = null
    }
  }, [])

  const stopRecording = async () => {
    const needsTeardown = hasSetupRecording.current
    if (needsTeardown) {
      hasSetupRecording.current = false
      await setupAudioMode(false)
    }
    recordEndRef.current = Date.now()

    if (meteringIntervalRef.current !== null) {
      clearInterval(meteringIntervalRef.current)
      meteringIntervalRef.current = null
    }

    if (recordStartRef.current > 0 && recorderRef.current) {
      try {
        await recorderRef.current.stop()
      } catch (e) {
        console.log('Recording stopping fail', e)
      }
    }
  }

  const onReset = async () => {
    try {
      await stopRecording()
    } catch {}
    releaseRecorder()
    ampTracker.reset()
    const path = pathRef.current
    pathRef.current = ''
    if (path) {
      try {
        new File(path).delete()
      } catch {}
    }
    recordStartRef.current = 0
    recordEndRef.current = 0
    setStagedRecording({duration: 0, path: ''})
    setStaged(false)
    setShowAudioSend(false)
  }
  const setCommandStatusInfo = InputState.useConversationInputDispatch(s => s.setCommandStatusInfo)

  const startRecording = () => {
    const impl = async () => {
      await onReset()
      const goodPerms = await checkPerms(setCommandStatusInfo)
      if (!goodPerms) {
        throw new Error("Couldn't get audio permissions")
      }

      await setupAudioMode(true)
      hasSetupRecording.current = true
      vibrate(true)

      const recorder = new AudioModule.AudioRecorder(recordingOptions)
      recorderRef.current = recorder
      await recorder.prepareToRecordAsync()
      const audioPath = recorder.uri?.replace(/^file:\/\//, '')
      if (!audioPath) {
        throw new Error("Couldn't start audio recording")
      }
      pathRef.current = audioPath

      recorder.record()
      recordStartRef.current = Date.now()
      recordEndRef.current = recordStartRef.current

      meteringIntervalRef.current = setInterval(() => {
        const status = recorderRef.current?.getStatus()
        const inamp = status?.metering
        if (inamp === undefined) return
        const amp = 10 ** (inamp * 0.05)
        ampTracker.addAmp(amp)
        const maxScale = 8
        const minScale = 3
        ampSV.set(withTiming(minScale + amp * (maxScale - minScale), {duration: 100}))
      }, 100)
    }

    impl()
      .then(() => {})
      .catch(() => {
        void onReset()
      })
    return
  }

  const {sendAudioRecording} = useConversationSendActions()

  const sendRecording = () => {
    const impl = async () => {
      await stopRecording()
      vibrate(false)
      const duration = (recordEndRef.current || recordStartRef.current) - recordStartRef.current
      const path = pathRef.current
      const amps = ampTracker.getBucketedAmps(duration)
      if (duration > 500 && path && amps.length) {
        await sendAudioRecording(path, duration, amps)
      } else {
        console.log('bail on too short or not path', duration, path)
      }
      await onReset()
    }
    impl()
      .then(() => {})
      .catch(() => {})
  }

  const cancelRecording = () => {
    onReset()
      .then(() => {})
      .catch(() => {})
  }

  const audioSend = showAudioSend ? (
    <AudioSend
      ampTracker={ampTracker}
      cancelRecording={cancelRecording}
      duration={stagedRecording.duration}
      path={stagedRecording.path}
      sendRecording={sendRecording}
    />
  ) : null

  const stageRecording = () => {
    const impl = async () => {
      await stopRecording()
      setStagedRecording({
        duration: (recordEndRef.current || recordStartRef.current) - recordStartRef.current,
        path: pathRef.current,
      })
      setStaged(true)
      setShowAudioSend(true)
    }
    impl()
      .then(() => {})
      .catch(() => {})
  }

  // on unmount cleanup
  const onResetEvent = React.useEffectEvent(onReset)
  React.useEffect(() => {
    return () => {
      setShowAudioSend(false)
      releaseRecorder()
      onResetEvent()
        .then(() => {})
        .catch(() => {})
    }
  }, [setShowAudioSend, releaseRecorder])

  return {audioSend, cancelRecording, sendRecording, stageRecording, staged, startRecording}
}

const AudioRecorder = function AudioRecorder(props: Props) {
  const {setShowAudioSend, showAudioSend} = props
  const ampSV = useSharedValue(0)

  const {startRecording, cancelRecording, sendRecording, stageRecording, audioSend} = useRecorder({
    ampSV,
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

  return (
    <>
      {tooltip}
      {audioSend}
      {icon}
      {overlay}
    </>
  )
}

const BigBackground = (props: {fadeSV: SVN}) => {
  'use no memo'
  const {fadeSV} = props
  const backgroundColor = Kb.Styles.undynamicColor(Kb.Styles.globalColors.white)
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor,
    opacity: fadeSV.value * 0.9,
    transform: [{scale: fadeSV.value}],
  }))
  return <Animated.View pointerEvents="box-none" style={[styles.bigBackgroundStyle, animatedStyle]} />
}

const AmpCircle = (props: {ampSV: SVN; dragXSV: SVN; dragYSV: SVN; fadeSV: SVN; lockedSV: SVN}) => {
  'use no memo'
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
  stageRecording: () => void
}) => {
  'use no memo'
  const {dragXSV, dragYSV, fadeSV, lockedSV, stageRecording} = props
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
  const iconStyle = useAnimatedStyle(() => {
    return {opacity: lockedSV.value}
  })
  return (
    <Animated.View style={[styles.innerCircleStyle, circleStyle]}>
      <Animated.View style={[iconStyle]}>
        <Kb.Icon type="iconfont-stop" color={Kb.Styles.globalColors.whiteOrWhite} onClick={stageRecording} />
      </Animated.View>
    </Animated.View>
  )
}

const LockHint = (props: {fadeSV: SVN; lockedSV: SVN; dragXSV: SVN; dragYSV: SVN}) => {
  'use no memo'
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
    } as const
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
      <AnimatedBox2 direction="vertical" style={[styles.lockHintStyle, arrowStyle as Kb.Styles._StylesCrossPlatform]}>
        <Kb.Icon type="iconfont-arrow-up" sizeType="Tiny" />
      </AnimatedBox2>
      <AnimatedBox2 direction="vertical" style={[styles.lockHintStyle, lockStyle as Kb.Styles._StylesCrossPlatform]}>
        <Kb.Icon type="iconfont-lock" />
      </AnimatedBox2>
    </>
  )
}

const AnimatedText = Animated.createAnimatedComponent(Kb.Text)

const CancelHint = (props: {fadeSV: SVN; dragXSV: SVN; lockedSV: SVN; onCancel: () => void}) => {
  'use no memo'
  const {lockedSV, fadeSV, onCancel, dragXSV} = props
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
      opacity: fadeSV.value * (1 - lockedSV.value),
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
  const textStyleLocked = useAnimatedStyle(() => {
    const dragDistanceX = -50
    const deltaX = 180
    const slideAmount = 220
    return {
      opacity: fadeSV.value * lockedSV.value,
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
      <AnimatedBox2 direction="vertical" style={[styles.cancelHintStyle, arrowStyle as Kb.Styles._StylesCrossPlatform]}>
        <Kb.Icon sizeType="Tiny" type={'iconfont-arrow-left'} />
      </AnimatedBox2>
      <AnimatedBox2 direction="vertical" style={[styles.cancelHintStyle, closeStyle as Kb.Styles._StylesCrossPlatform]}>
        <Kb.Icon sizeType="Tiny" type={'iconfont-close'} color={Kb.Styles.globalColors.black_20} />
      </AnimatedBox2>
      <AnimatedText
        type="BodySmallPrimaryLink"
        onClick={onCancel}
        style={[styles.cancelHintStyle, textStyleLocked]}
      >
        Cancel
      </AnimatedText>
      <AnimatedText type="BodySmall" onClick={onCancel} style={[styles.cancelHintStyle, textStyle]}>
        Slide to cancel
      </AnimatedText>
    </>
  )
}

const SendRecordingButton = (props: {fadeSV: SVN; lockedSV: SVN; sendRecording: () => void}) => {
  'use no memo'
  const {fadeSV, lockedSV, sendRecording} = props
  const backgroundColor = Kb.Styles.undynamicColor(Kb.Styles.globalColors.blue)
  const buttonStyle = useAnimatedStyle(() => ({
    backgroundColor,
    opacity: lockedSV.value ? fadeSV.value : withTiming(0),
    transform: [{translateY: withTiming(lockedSV.value ? -100 : 50)}],
  }))
  return (
    <Animated.View style={[styles.sendRecordingButtonStyle, buttonStyle]}>
      <Kb.Icon
        padding="tiny"
        color={Kb.Styles.globalColors.whiteOrWhite}
        onClick={sendRecording}
        sizeType="Small"
        type="iconfont-arrow-full-up"
      />
    </Animated.View>
  )
}

const AudioCounter = () => {
  const [seconds, setSeconds] = React.useState(0)
  const [startTime] = React.useState(() => Date.now())
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSeconds((Date.now() - startTime) / 1000)
    }, 1000)
    return () => clearTimeout(timer)
  }, [seconds, startTime])
  return <Kb.Text type="BodyBold">{formatAudioRecordDuration(seconds * 1000)}</Kb.Text>
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  ampCircleStyle: {
    ...circleAroundIcon(34),
  },
  audioCounterStyle: {
    bottom: micCenterBottom - 10,
    left: 10,
    position: 'absolute',
  },
  bigBackgroundStyle: {
    ...circleAroundIcon(Kb.Styles.isTablet ? 2000 : 750),
  },
  cancelHintStyle: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    bottom: micCenterBottom - 10,
    paddingLeft: 20,
    position: 'absolute' as const,
    right: micCenterRight,
    width: 140,
  },
  container: {
    ...Kb.Styles.globalStyles.fillAbsolute,
    justifyContent: 'flex-start',
  },
  iconStyle: {padding: Kb.Styles.globalMargins.tiny},
  innerCircleStyle: {
    ...circleAroundIcon(84),
    ...Kb.Styles.centered(),
  },
  lockHintStyle: {
    ...centerAroundIcon(32),
  },
  sendRecordingButtonStyle: {
    ...circleAroundIcon(32),
    ...Kb.Styles.centered(),
  },
  tooltipContainer: {
    backgroundColor: Kb.Styles.globalColors.black,
    borderRadius: Kb.Styles.borderRadius,
    bottom: 45,
    padding: Kb.Styles.globalMargins.tiny,
    position: 'absolute',
    right: 20,
  },
}))

export default AudioRecorder
