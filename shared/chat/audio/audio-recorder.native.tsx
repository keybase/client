import * as Chat from '@/stores/chat2'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {Portal} from '@/common-adapters/portal.native'
import * as React from 'react'
// we need to use the raw colors to animate
import {colors} from '@/styles/colors'
import * as Reanimated from 'react-native-reanimated'
import {AmpTracker} from './amptracker'
import {
  Gesture,
  GestureDetector,
  type GestureUpdateEvent,
  type PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler'
import {View} from 'react-native'
import {formatAudioRecordDuration} from '@/util/timestamp'
import {Audio} from 'expo-av'
import {setupAudioMode} from '@/util/audio.native'
import logger from '@/logger'
import * as Haptics from 'expo-haptics'
import * as FileSystem from 'expo-file-system'
import AudioSend from './audio-send.native'

const {useSharedValue, Extrapolation, useAnimatedStyle} = Reanimated
const {interpolate, withSequence, withSpring, runOnJS} = Reanimated
const {useAnimatedReaction, withDelay, withTiming, interpolateColor, default: Animated} = Reanimated
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

  const flashTip = React.useCallback(() => {
    'worklet'
    runOnJS(setShowTooltip)(true)
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
  'use no memo'
  const {stageRecording, startRecording, sendRecording, cancelRecording, flashTip, ampSV} = p
  const [visible, setVisible] = React.useState(Visible.HIDDEN)

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

  const onReset = React.useCallback(() => {
    'worklet'
    fadeSV.set(withTiming(0, {duration: 200}))
    dragXSV.set(0)
    dragYSV.set(0)
    lockedSV.set(0)
    canceledSV.set(0)
  }, [fadeSV, dragXSV, dragYSV, lockedSV, canceledSV])

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

  const onFlashTip = React.useCallback(() => {
    flashTip()
    onCancelRecording()
  }, [flashTip, onCancelRecording])

  const [iconVisible, setIconVisible] = React.useState(false)

  // work around bug in gesture handler where it crashes on mount
  React.useEffect(() => {
    const id = setTimeout(() => {
      setIconVisible(true)
      return () => {
        clearTimeout(id)
      }
    }, 1000)
  }, [])
  const panStartSV = useSharedValue(0)

  const gesture = React.useMemo(() => {
    let id: number
    const showOverlay = () => {
      // we get this multiple times for some reason
      if (startedSV.value) {
        return
      }
      startedSV.set(1)
      fadeSV.set(withSpring(1, {duration: 200}))
      startRecording()
    }

    const setupOverlayTimeout = () => {
      id = setTimeout(() => {
        showOverlay()
      }, 200) as unknown as number
    }
    const cleanupOverlayTimeout = () => {
      clearTimeout(id)
      id = 0
    }

    const panGesture = Gesture.Pan()
      .minDistance(0)
      .minPointers(1)
      .maxPointers(1)
      .onTouchesDown(() => {
        'worklet'
        runOnJS(setupOverlayTimeout)()
        if (!panStartSV.value) {
          panStartSV.set(Date.now())
        }
      })
      .onFinalize((_e: unknown, _success: boolean) => {
        'worklet'
        const diff = Date.now() - panStartSV.value
        startedSV.set(0)
        panStartSV.set(0)
        runOnJS(cleanupOverlayTimeout)()
        const needTip = diff < 200
        const wasCancel = canceledSV.value === 1
        const panLocked = lockedSV.value === 1
        if (wasCancel) {
          runOnJS(onCancelRecording)()
          return
        }

        if (needTip) {
          runOnJS(onFlashTip)()
          return
        }

        if (!panLocked) {
          runOnJS(sendRecording)()
          onReset()
          fadeSV.set(withTiming(0, {duration: 200}))
        }
      })
      .onUpdate((e: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
        'worklet'
        if (lockedSV.value || canceledSV.value) {
          return
        }
        const maxCancelDrift = -120
        const maxLockDrift = -100
        dragYSV.set(interpolate(e.translationY, [maxLockDrift, 0], [maxLockDrift, 0], Extrapolation.CLAMP))
        dragXSV.set(
          interpolate(e.translationX, [maxCancelDrift, 0], [maxCancelDrift, 0], Extrapolation.CLAMP)
        )
        if (e.translationX < maxCancelDrift) {
          canceledSV.set(1)
        } else if (e.translationY < maxLockDrift) {
          lockedSV.set(1)
        }
      })
    return panGesture
  }, [
    onReset,
    panStartSV,
    fadeSV,
    onFlashTip,
    lockedSV,
    canceledSV,
    dragXSV,
    dragYSV,
    startRecording,
    sendRecording,
    onCancelRecording,
    startedSV,
  ])

  const icon = iconVisible ? (
    <View>
      <GestureDetector gesture={gesture}>
        <Kb.Box2 direction="vertical" collapsable={false}>
          <Kb.Icon type="iconfont-mic" style={styles.iconStyle} />
        </Kb.Box2>
      </GestureDetector>
    </View>
  ) : (
    <Kb.Icon type="iconfont-mic" style={styles.iconStyle} />
  )

  const durationStyle = useAnimatedStyle(() => ({
    opacity: fadeSV.value,
  }))

  const overlay =
    visible === Visible.HIDDEN ? null : (
      <Portal hostName="convOverlay" useFullScreenOverlay={false}>
        <Animated.View style={styles.container} pointerEvents="box-none">
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

const makeRecorder = async (onRecordingStatusUpdate: (s: Audio.RecordingStatus) => void) => {
  vibrate(true)

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
  return recording
}

// Hook for interfacing with the native recorder
const useRecorder = (p: {ampSV: SVN; setShowAudioSend: (s: boolean) => void; showAudioSend: boolean}) => {
  const {ampSV, setShowAudioSend, showAudioSend} = p
  const recordingRef = React.useRef<Audio.Recording | undefined>(undefined)
  const recordStartRef = React.useRef(0)
  const recordEndRef = React.useRef(0)
  const hasSetupRecording = React.useRef(false)
  const pathRef = React.useRef('')
  const ampTracker = React.useRef(new AmpTracker()).current
  const [staged, setStaged] = React.useState(false)

  const stopRecording = React.useCallback(async () => {
    const needsTeardown = hasSetupRecording.current
    if (needsTeardown) {
      hasSetupRecording.current = false
      await setupAudioMode(false)
    }
    recordEndRef.current = Date.now()

    const recording = recordingRef.current
    recordingRef.current = undefined
    if (recording) {
      recording.setOnRecordingStatusUpdate(null)
      try {
        await recording.stopAndUnloadAsync()
      } catch (e) {
        console.log('Recoding stopping fail', e)
      }
    }
  }, [])

  const onReset = React.useCallback(async () => {
    try {
      await stopRecording()
    } catch {}
    ampTracker.reset()
    const path = pathRef.current
    pathRef.current = ''
    if (path) {
      try {
        await FileSystem.deleteAsync(path, {idempotent: true})
      } catch {}
    }
    recordStartRef.current = 0
    recordEndRef.current = 0
    setStaged(false)
    setShowAudioSend(false)
  }, [setStaged, ampTracker, stopRecording, setShowAudioSend])
  const setCommandStatusInfo = Chat.useChatContext(s => s.dispatch.setCommandStatusInfo)

  const startRecording = React.useCallback(() => {
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
        setCommandStatusInfo({
          actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
          displayText: `Failed to access audio. ${error.message}`,
          displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
        })
      }
      return false
    }
    const impl = async () => {
      await onReset()
      const goodPerms = await checkPerms()
      if (!goodPerms) {
        throw new Error("Couldn't get audio permissions")
      }

      await setupAudioMode(true)
      hasSetupRecording.current = true
      const onRecordingStatusUpdate = (status: Audio.RecordingStatus) => {
        const inamp = status.metering
        if (inamp === undefined) {
          return
        }
        const amp = 10 ** (inamp * 0.05)
        ampTracker.addAmp(amp)
        const maxScale = 8
        const minScale = 3
        ampSV.set(withTiming(minScale + amp * (maxScale - minScale), {duration: 100}))
      }

      const recording = await makeRecorder(onRecordingStatusUpdate)
      const audioPath = recording.getURI()?.substring('file://'.length)
      if (!audioPath) {
        throw new Error("Couldn't start audio recording")
      }
      pathRef.current = audioPath
      recordingRef.current = recording

      await recording.startAsync()
      recordStartRef.current = Date.now()
      recordEndRef.current = recordStartRef.current
    }

    impl()
      .then(() => {})
      .catch(() => {
        onReset()
          // eslint-disable-next-line
          .then(() => {})
          // eslint-disable-next-line
          .catch(() => {})
      })
    return
  }, [setCommandStatusInfo, ampTracker, onReset, ampSV])

  const sendAudioRecording = Chat.useChatContext(s => s.dispatch.sendAudioRecording)

  const sendRecording = React.useCallback(() => {
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
  }, [sendAudioRecording, ampTracker, onReset, stopRecording])

  const cancelRecording = React.useCallback(() => {
    onReset()
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
    return () => {
      setShowAudioSend(false)
      onReset()
        .then(() => {})
        .catch(() => {})
    }
  }, [onReset, setShowAudioSend])

  return {audioSend, cancelRecording, sendRecording, stageRecording, staged, startRecording}
}

const AudioRecorder = React.memo(function AudioRecorder(props: Props) {
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
})

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
      <Kb.Box2Animated
        direction="vertical"
        style={[styles.lockHintStyle, arrowStyle as Kb.Styles._StylesCrossPlatform]}
      >
        <Kb.Icon type="iconfont-arrow-up" sizeType="Tiny" />
      </Kb.Box2Animated>
      <Kb.Box2Animated
        direction="vertical"
        style={[styles.lockHintStyle, lockStyle as Kb.Styles._StylesCrossPlatform]}
      >
        <Kb.Icon type="iconfont-lock" />
      </Kb.Box2Animated>
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
      <Kb.Box2Animated direction="vertical" style={[styles.cancelHintStyle, arrowStyle]}>
        <Kb.Icon sizeType="Tiny" type={'iconfont-arrow-left'} />
      </Kb.Box2Animated>
      <Kb.Box2Animated direction="vertical" style={[styles.cancelHintStyle, closeStyle]}>
        <Kb.Icon sizeType="Tiny" type={'iconfont-close'} />
      </Kb.Box2Animated>
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
  cancelHintIcon: {
    left: 0,
    position: 'absolute',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockHintStyle: {
    ...centerAroundIcon(32),
  },
  sendRecordingButtonStyle: {
    ...circleAroundIcon(32),
    alignItems: 'center',
    justifyContent: 'center',
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
