import * as Chat2Gen from '../../actions/chat2-gen'
import * as Container from '../../util/container'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Kb from '../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../styles'
import type * as Types from '../../constants/types/chat2'
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
// import * as FileSystem from 'expo-file-system'
// import AudioSend, {ShowAudioSendContext} from './audio-send'

type SVN = SharedValue<number>

type Props = {
  conversationIDKey: Types.ConversationIDKey
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
}) => {
  const {stageRecording, startRecording, sendRecording, cancelRecording, flashTip} = p
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
  const panGesture = Gesture.Pan()
    .minDistance(0)
    .minPointers(1)
    .maxPointers(1)
    .activateAfterLongPress(200)
    .onStart(() => {
      console.log('aaa pan onStart')
      runOnJS(onPanStart)()
    })
    .onFinalize((_e, success) => {
      console.log('aaa pan onFinalize', success)
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
  const ampSV = useSharedValue(0)

  const updateAmpScale = React.useCallback(
    (amp: number) => {
      const maxScale = 8
      const minScale = 3
      const scaled = minScale + amp * (maxScale - minScale)
      ampSV.value = withTiming(scaled, {duration: 100})
    },
    [ampSV]
  )
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
          <AmpCircle fadeSV={fadeSV} ampSV={ampSV} dragXSV={dragXSV} dragYSV={dragYSV} locked={lockedSV} />
          <InnerCircle
            fadeSV={fadeSV}
            dragXSV={dragXSV}
            dragYSV={dragYSV}
            locked={lockedSV}
            stageRecording={stageRecording}
          />
          <LockHint fadeSV={fadeSV} dragXSV={dragXSV} dragYSV={dragYSV} locked={lockedSV} />
          <CancelHint onCancel={onCancelRecording} fadeSV={fadeSV} locked={lockedSV} dragXSV={dragXSV} />
          <SendRecordingButton fadeSV={fadeSV} locked={lockedSV} sendRecording={onSendRecording} />
          <AudioCounter fadeSV={fadeSV} />
        </Animated.View>
      </Portal>
    )

  return {icon, locked, overlay, updateAmpScale}
}

// const useAudioSend = (p: {
//   stopRecording: any // TODO
//   onSendAudioRecording: any // TODO
// }) => {
//   const {stopRecording, onSendAudioRecording} = p
//   const {showAudioSend, setShowAudioSend} = React.useContext(ShowAudioSendContext)

//   const cancelRecording = React.useCallback(() => {
//     stopRecording(AudioStopType.CANCEL)
//       .then(() => {})
//       .catch(() => {})
//   }, [stopRecording])
//   const sendStagedRecording = React.useCallback(() => {
//     onSendAudioRecording(true)
//       .then(() => {})
//       .catch(() => {})
//   }, [onSendAudioRecording])

//   const audioSend =
//     recordingStatus === AudioRecordingStatus.STAGED ? (
//       <Portal hostName="audioSend">
//         <AudioSend
//           cancelRecording={cancelRecording}
//           sendRecording={sendStagedRecording}
//           duration={duration}
//           amps={info.amps}
//           path={info.path}
//         />
//       </Portal>
//     ) : null

//   // update context so the input can show it
//   if (!!audioSend !== showAudioSend) {
//     setShowAudioSend(!!audioSend)
//   }

//   return {audioSend}
// }

// Hook for gestures and animations
// const useAnimation = () => {
// }

const vibrate = (_short: boolean) => {
  if (Container.isIOS) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      .then(() => {})
      .catch(() => {})
  } else {
    Vibration.vibrate(50)
  }
}

const makeRecorder = async (onRecordingStatusUpdate: (s: Audio.RecordingStatus) => void) => {
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
  return recording
}

// Hook for interfacing with the native recorder
const useRecorder = (p: {conversationIDKey: Types.ConversationIDKey; ampSV: SVN}) => {
  const {conversationIDKey, ampSV} = p
  const recordingRef = React.useRef<Audio.Recording | undefined>()
  const recordStartRef = React.useRef(0)
  const recordEndRef = React.useRef(0)
  const pathRef = React.useRef('')
  // const recordingStatusRef = React.useRef(AudioRecordingStatus.INITIAL)
  const dispatch = Container.useDispatch()
  const ampTracker = React.useRef(new AmpTracker()).current

  const onReset = React.useCallback(async () => {
    const r = recordingRef.current
    try {
      r?.setOnRecordingStatusUpdate(null)
    } catch {}
    try {
      await r?.stopAndUnloadAsync()
    } catch {}
    recordingRef.current = undefined
    ampTracker.reset()
    pathRef.current = ''
    // recordingStatusRef.current = AudioRecordingStatus.INITIAL
    recordStartRef.current = 0
    recordEndRef.current = 0
  }, [ampTracker])

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
      }
      return false
    }
    const impl = async () => {
      await onReset()
      const goodPerms = await checkPerms()
      if (!goodPerms) {
        await onReset()
        return
      }

      const onRecordingStatusUpdate = (status: Audio.RecordingStatus) => {
        const inamp = status.metering
        if (inamp === undefined) {
          return
        }
        const amp = 10 ** (inamp * 0.05)
        ampTracker.addAmp(amp)
        ampSV.value = amp
      }

      const recording = await makeRecorder(onRecordingStatusUpdate)
      const audioPath = recording.getURI()?.substring('file://'.length)
      if (!audioPath) {
        await onReset()
        throw new Error("Couldn't start audio recording")
      }
      pathRef.current = audioPath
      recordingRef.current = recording

      try {
        await recording.startAsync()
        // recordingStatusRef.current = AudioRecordingStatus.RECORDING
        recordStartRef.current = Date.now()
        recordEndRef.current = recordStartRef.current
      } catch {
        await onReset()
      }
    }
    impl()
      .then(() => {})
      .catch(() => {})
    return
  }, [ampTracker, conversationIDKey, dispatch, onReset, ampSV])

  //   // const onSendAudioRecording = React.useCallback(
  //   //   async (fromStaged: boolean) => {
  //   //     recordingRef.current = undefined
  //   //     if (!fromStaged) {
  //   //       if (Container.isIOS) {
  //   //         try {
  //   //           await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  //   //         } catch {}
  //   //       } else {
  //   //         Vibration.vibrate(50)
  //   //       }
  //   //     }
  //   //     audioInfoRef.current = undefined
  //   //     if (info) {
  //   //       const duration = audioRecordingDuration(info)
  //   //       submitRecording(duration)
  //   //       dispatch(
  //   //         Chat2Gen.createSendAudioRecording({
  //   //           amps: info.amps?.getBucketedAmps(duration) ?? [],
  //   //           conversationIDKey,
  //   //           duration,
  //   //           fromStaged,
  //   //           path: info.path,
  //   //         })
  //   //       )
  //   //     }
  //   //   },
  //   //   [dispatch, conversationIDKey]
  //   // )
  const sendRecording = React.useCallback(() => {
    console.log('aaa sendrecording')
  }, [])
  const stageRecording = React.useCallback(() => {
    console.log('aaa stage recording')
  }, [])
  const cancelRecording = React.useCallback(() => {
    console.log('aaa cancel recording')
  }, [])
  //   const stopRecording = React.useCallback(async (stopType: AudioStopType) => {
  //     // recordEndRef.current = Date.now()
  //     // let nextStatus = recordingStatusRef.current
  //     // if (nextStatus === AudioRecordingStatus.CANCELLED) {
  //     //   return
  //     // }
  //     // if (locked) {
  //     //   switch (stopType) {
  //     //     case AudioStopType.CANCEL:
  //     //       recordingStatusRef.current = AudioRecordingStatus.CANCELLED
  //     //       break
  //     //     case AudioStopType.SEND:
  //     //       recordingStatusRef.current = AudioRecordingStatus.STOPPED
  //     //       break
  //     //     case AudioStopType.STOPBUTTON:
  //     //       recordingStatusRef.current = AudioRecordingStatus.STAGED
  //     //       break
  //     //     case AudioStopType.RELEASE:
  //     //       break
  //     //   }
  //     // } else {
  //     //   switch (stopType) {
  //     //     case AudioStopType.CANCEL:
  //     //       recordingStatusRef.current = AudioRecordingStatus.CANCELLED
  //     //       break
  //     //     default:
  //     //       recordingStatusRef.current = AudioRecordingStatus.STOPPED
  //     //   }
  //     // }
  //     // if (info) {
  //     //   // don't do anything if we are recording and are in locked mode.
  //     //   if (showAudioRecording(recordingStatus) && locked) {
  //     //     return
  //     //   }
  //     // }
  //     // logger.info('stopAudioRecording: stopping recording')
  //     // const recording = recordingRef.current
  //     // recording?.setOnRecordingStatusUpdate(null)
  //     // try {
  //     //   await recording?.stopAndUnloadAsync()
  //     // } catch (e) {
  //     //   console.log('Recoding stopping fail', e)
  //     // } finally {
  //     //   recordingRef.current = undefined
  //     // }
  //     // if (!info) {
  //     //   logger.info('stopAudioRecording: no audio record, not sending')
  //     //   return
  //     // }
  //     // let cancelRecord = recordingStatus === AudioRecordingStatus.CANCELLED || stopType === AudioStopType.CANCEL
  //     // if (audioRecordingDuration(info) < 500 || info.path.length === 0) {
  //     //   logger.info('stopAudioRecording: recording too short, skipping')
  //     //   cancelRecord = true
  //     //   await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  //     // }
  //     // if (cancelRecord) {
  //     //   logger.info('stopAudioRecording: recording cancelled, bailing out')
  //     //   try {
  //     //     if (info.path) {
  //     //       await FileSystem.deleteAsync(info.path, {idempotent: true})
  //     //     }
  //     //   } catch (e) {
  //     //     console.log('Recording delete failed', e)
  //     //   }
  //     //   return
  //     // }
  //     // if (recordingStatus === AudioRecordingStatus.STAGED) {
  //     //   logger.info('stopAudioRecording: in staged mode, not sending')
  //     //   return
  //     // }
  //     // await onSendAudioRecording(false)
  //   }, [])

  //   // on unmount stop
  //   React.useEffect(() => {
  //     return () => {
  //       stopRecording(AudioStopType.CANCEL)
  //         .then(() => {})
  //         .catch(() => {})
  //     }
  //   }, [stopRecording])

  return {cancelRecording, sendRecording, stageRecording, startRecording}
}

const AudioRecorder = React.memo(function AudioRecorder(props: Props) {
  const {conversationIDKey} = props

  const ampSV = useSharedValue(0)

  const {startRecording, cancelRecording, sendRecording, stageRecording} = useRecorder({
    ampSV,
    conversationIDKey,
  })

  // const {audioSend} = useAudioSend({
  //   stopRecording,
  //   onSendAudioRecording,
  // })
  // const {overlay, updateAmpScale} = useOverlay({
  //   dragXSV,
  //   dragYSV,
  //   locked,
  //   onCancel,
  //   setVisible,
  //   stopRecording,
  //   visible,
  // })
  // const {icon} = useIcon({dragXSV, dragYSV, stopRecording})

  // const {icon, tooltip} = useIconAndTooltip({
  //   dragXSV,
  //   dragYSV,
  //   stopRecording,
  //   startRecording,
  //   locked,
  //   setLocked,
  // })
  // const dispatch = Container.useDispatch()

  // const onCancel = React.useCallback(async () => {
  //   await stopRecording(AudioStopType.CANCEL)
  // }, [stopRecording])

  // console.log('aaa render audio reocrder', {
  //   audioSend,
  //   locked,
  //   showToolTip,
  //   visible,
  // })

  // const {dragXSV, dragYSV, updateAmpScale, overlay, icon, audioSend} = useAnimation()
  //
  const {tooltip, flashTip} = useTooltip()
  // TODO maybr move useIconAndOverlay to this
  const {icon, overlay} = useIconAndOverlay({
    cancelRecording,
    flashTip,
    sendRecording,
    stageRecording,
    startRecording,
  })

  // TODO
  const audioSend = null

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

const AmpCircle = (props: {ampSV: SVN; dragXSV: SVN; dragYSV: SVN; fadeSV: SVN; locked: SVN}) => {
  const {ampSV, dragXSV, dragYSV, fadeSV, locked} = props
  const animatedStyle = useAnimatedStyle(() => {
    const dragDistanceX = -50
    const dragXOpacity =
      dragYSV.value < -10 ? 1 : interpolate(dragXSV.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
    return {
      opacity: withTiming(dragXOpacity),
      transform: [{translateY: locked.value ? 0 : dragYSV.value}, {scale: ampSV.value * fadeSV.value}],
    }
  })
  return (
    <Animated.View
      style={[
        styles.ampCircleStyle,
        {
          backgroundColor: locked.value
            ? Styles.globalColors.redLight
            : Styles.globalColors.blueLighterOrBlueLight,
        },
        animatedStyle,
      ]}
    />
  )
}

const InnerCircle = (props: {
  dragXSV: SVN
  dragYSV: SVN
  fadeSV: SVN
  locked: SVN
  stageRecording: () => void
}) => {
  const {dragXSV, dragYSV, fadeSV, locked, stageRecording} = props
  const circleStyle = useAnimatedStyle(() => {
    // worklet needs this locally for some reason
    const dragDistanceX = -50
    const dragXOpacity =
      dragYSV.value < -10 ? 1 : interpolate(dragXSV.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
    return {
      opacity: withTiming(dragXOpacity),
      transform: [{translateY: locked.value ? 0 : dragYSV.value}, {scale: fadeSV.value}],
    }
  })
  const stopStyle = useAnimatedStyle(() => ({opacity: locked.value ? withTiming(1) : 0}))
  return (
    <Animated.View
      style={[
        styles.innerCircleStyle,
        {backgroundColor: locked.value ? Styles.globalColors.red : Styles.globalColors.blue},
        circleStyle,
      ]}
    >
      <AnimatedIcon
        type="iconfont-stop"
        color={Styles.globalColors.whiteOrWhite}
        onClick={stageRecording}
        style={stopStyle}
      />
    </Animated.View>
  )
}

const LockHint = (props: {fadeSV: SVN; locked: SVN; dragXSV: SVN; dragYSV: SVN}) => {
  const {locked, fadeSV, dragXSV, dragYSV} = props
  const slideAmount = 150
  const spaceBetween = 20
  const deltaY = 50
  const arrowStyle = useAnimatedStyle(() => {
    // worklet needs this locally for some reason
    const dragDistanceX = -50
    const dragXOpacity =
      dragYSV.value < -10 ? 1 : interpolate(dragXSV.value, [dragDistanceX, 0], [0, 1], Extrapolation.CLAMP)
    return {
      opacity: locked.value
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
      opacity: locked.value ? withTiming(0) : fadeSV.value * dragXOpacity,
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

const CancelHint = (props: {fadeSV: SVN; dragXSV: SVN; locked: SVN; onCancel: () => void}) => {
  const {locked, fadeSV, onCancel, dragXSV} = props
  const arrowStyle = useAnimatedStyle(() => {
    // copy paste so we don't share as many vars between jsc contexts
    const dragDistanceX = -50
    const deltaX = 180
    const slideAmount = 220
    const spaceBetween = 20
    return {
      opacity: locked.value
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
      opacity: locked.value
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
        type={locked.value ? 'BodySmallPrimaryLink' : 'BodySmall'}
        onClick={onCancel}
        style={[styles.cancelHintStyle, textStyle]}
      >
        {locked.value ? 'Cancel' : 'Slide to cancel'}
      </AnimatedText>
    </>
  )
}

const SendRecordingButton = (props: {fadeSV: SVN; locked: SVN; sendRecording: () => void}) => {
  const {fadeSV, locked, sendRecording} = props
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: locked.value ? fadeSV.value : withTiming(0),
    transform: [{translateY: withTiming(locked.value ? -100 : 50)}],
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
