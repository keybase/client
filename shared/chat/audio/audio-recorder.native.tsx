import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
// import {formatAudioRecordDuration} from '../../util/timestamp'
import {isIOS} from '../../constants/platform'
import {AmpTracker} from './amptracker'
import AudioStarter from './audio-starter.native'
import {Portal} from '@gorhom/portal'
// import {View} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  withTiming,
  type SharedValue,
  // useDerivedValue,
  runOnJS,
  Extrapolation,
} from 'react-native-reanimated'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  iconStyle?: Kb.IconStyle
}

// hook to help deal with visibility request changing. we animate in / out and truly hide when we're done animating
const useVisible = (reduxVisible: boolean, dragX: SharedValue<number>, dragY: SharedValue<number>) => {
  console.log('ccc usevisible', reduxVisible)
  const [visible, setVisible] = React.useState(reduxVisible)
  const initialBounce = useSharedValue(reduxVisible ? 1 : 0)
  React.useEffect(() => {
    // not showing somehow? immediately show
    if (!visible && reduxVisible) {
      setVisible(true)
    }
    initialBounce.value = reduxVisible
      ? withTiming(1, {
          duration: 300,
          easing: Easing.elastic(2),
        })
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
  const unifyAmp = (amp: number) => {
    return isIOS ? 10 ** (amp * 0.05) : Math.min(1.0, amp / 22000)
  }
  const ampToScale = (amp: number) => {
    const maxScale = 8
    const minScale = 3
    return minScale + amp * (maxScale - minScale)
  }
  const meteringCb = React.useCallback(
    (inamp: number) => {
      const amp = unifyAmp(inamp)
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
    (/*stopType: Types.AudioStopType*/) => {
      dispatch(
        Chat2Gen.createStopAudioRecording({
          amps: ampTracker,
          conversationIDKey,
          stopType: Types.AudioStopType.CANCEL, // TEMP always cancel
        })
      )
    },
    [dispatch, ampTracker, conversationIDKey]
  )

  return {ampScale, enableRecording, stopRecording}
}

const AudioRecorder = (props: Props) => {
  const {conversationIDKey} = props
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  // const closingDown = useSharedValue(0)
  // const [closingDown, setClosingDown] = React.useState(false)
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
  // const onCancel = React.useCallback(() => {
  //   dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.CANCEL}))
  // }, [dispatch, conversationIDKey])
  // const sendRecording = React.useCallback(() => stopRecording(Types.AudioStopType.SEND), [stopRecording])
  // const stageRecording = React.useCallback(() => {
  //   stopRecording(Types.AudioStopType.STOPBUTTON)
  // }, [stopRecording])

  // render
  // const noShow = !Constants.showAudioRecording(audioRecording)
  // if (!visible && !noShow) {
  //   closingDown.value = 0
  //   // setClosingDown(false)
  //   setVisible(true)
  // } else if (visible && noShow && !closingDown.value) {
  //   closingDown.value = 1
  //   // setClosingDown(true)
  //   initialBounce.value = withTiming(0)
  //   setTimeout(() => setVisible(false), 500)
  // }

  // React.useEffect(() => {
  //   if (closingDown.value || locked) {
  //     dragY.value = 0
  //   }
  // }, [locked, closingDown, dragY])

  // const recording =
  //   !!audioRecording &&
  //   (audioRecording.status === Types.AudioRecordingStatus.INITIAL ||
  //     audioRecording.status === Types.AudioRecordingStatus.RECORDING)
  return (
    <>
      <AudioStarter
        conversationIDKey={conversationIDKey}
        dragY={dragY}
        dragX={dragX}
        enableRecording={enableRecording}
        stopRecording={stopRecording}
        iconStyle={props.iconStyle}
      />
      <Portal hostName="convOverlay">
        {!visible ? null : (
          <Animated.View style={styles.container} pointerEvents="box-none">
            <BigBackground initialBounce={initialBounce} />
            <AmpCircle initialBounce={initialBounce} ampScale={ampScale} dragY={dragY} locked={locked} />
            <InnerCircle initialBounce={initialBounce} dragY={dragY} locked={locked} />
            <LockHint initialBounce={initialBounce} locked={locked} />
            <CancelHint onCancel={onCancel} initialBounce={initialBounce} locked={locked} dragX={dragX} />
            {/*<AudioButton
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
            */}
          </Animated.View>
        )}
      </Portal>
    </>
  )
}

// type ButtonProps = {
//   ampScale: SharedValue<number>
//   closingDown: SharedValue<number>
//   dragY: SharedValue<number>
//   locked: boolean
//   sendRecording: () => void
//   initialBounce: SharedValue<number>
//   stageRecording: () => void
// }

const BigBackground = (props: {initialBounce: SharedValue<number>}) => {
  const {initialBounce} = props
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: initialBounce.value * 0.9,
    transform: [{scale: initialBounce.value}],
  }))
  return <Animated.View pointerEvents="box-none" style={[styles.bigBackgroundStyle, animatedStyle]} />
}

const AmpCircle = (props: {
  ampScale: SharedValue<number>
  dragY: SharedValue<number>
  initialBounce: SharedValue<number>
  locked: boolean
}) => {
  const {ampScale, dragY, initialBounce, locked} = props
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateY: locked ? 0 : dragY.value}, {scale: ampScale.value * initialBounce.value}],
  }))
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
  dragY: SharedValue<number>
  initialBounce: SharedValue<number>
  locked: boolean
}) => {
  const {dragY, initialBounce, locked} = props
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{translateY: locked ? 0 : dragY.value}, {scale: initialBounce.value}],
  }))
  return (
    <Animated.View
      style={[
        styles.innerCircleStyle,
        {backgroundColor: locked ? Styles.globalColors.red : Styles.globalColors.blue},
        animatedStyle,
      ]}
    />
  )
}

const LockHint = (props: {initialBounce: SharedValue<number>; locked: boolean}) => {
  const {locked, initialBounce} = props
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: locked ? withTiming(0) : 1,
    transform: [{translateY: 50 - initialBounce.value * 150}],
  }))
  return (
    <Animated.View style={[styles.lockHintStyle, animatedStyle]}>
      <Kb.Icon type="iconfont-arrow-up" sizeType="Tiny" />
      <Kb.Icon type="iconfont-lock" />
    </Animated.View>
  )
}

const AnimatedIcon = Animated.createAnimatedComponent(Kb.Icon)

const CancelHint = (props: {
  initialBounce: SharedValue<number>
  dragX: SharedValue<number>
  locked: boolean
  onCancel: () => void
  conversationIDKey: Types.ConversationIDKey
}) => {
  const {locked, initialBounce, onCancel, dragX} = props
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: initialBounce.value,
    transform: [{translateX: 160 - initialBounce.value * 220}],
  }))

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: initialBounce.value * interpolate(dragX.value, [-50, 0], [0, 1], Extrapolation.CLAMP),
  }))
  const closeStyle = useAnimatedStyle(() => ({
    opacity: initialBounce.value * interpolate(dragX.value, [-50, 0], [1, 0], Extrapolation.CLAMP),
  }))

  return (
    <Animated.View style={[styles.cancelHintStyle, animatedStyle]}>
      <AnimatedIcon
        sizeType="Tiny"
        type={'iconfont-arrow-left'}
        style={[styles.cancelHintIcon, arrowStyle]}
      />
      <AnimatedIcon sizeType="Tiny" type={'iconfont-close'} style={[styles.cancelHintIcon, closeStyle]} />
      <Kb.Text type={locked ? 'BodySmallPrimaryLink' : 'BodySmall'} onClick={onCancel}>
        {locked ? 'Cancel' : 'Slide to cancel'}
      </Kb.Text>
    </Animated.View>
  )
}

// const AudioButton = (props: ButtonProps) => {
//   const {initialBounce, locked, closingDown, ampScale, dragY, sendRecording, stageRecording} = props
//   console.log('bbb audiobutton render', {initialBounce})
//   const innerScale = useSharedValue(0)
//   const sendTranslate = useSharedValue(0)
//   const innerOffsetY = useSharedValue(-34)
//   const ampOffsetY = useSharedValue(-31)
//   const micOffsetY = useSharedValue(-34)

//   innerScale.value = withTiming(3, {easing: Easing.elastic(1)})
//   React.useEffect(() => {
//     if (locked) {
//       sendTranslate.value = withTiming(1, {
//         easing: Easing.elastic(1),
//       })
//     }
//   }, [locked, sendTranslate])

//   // React.useEffect(() => {
//   //   console.log('bbb audiobutton useeffect ', {closingDown})
//   //   if (!closingDown) {
//   //     return
//   //   }
//   //   outerScale.value = withTiming(0)
//   //   innerScale.value = withTiming(0)
//   //   sendTranslate.value = withTiming(0)
//   //   ampScale.value = withTiming(0)
//   // }, [closingDown, innerScale, outerScale, sendTranslate, ampScale])

//   const innerSizeStyle = useAnimatedStyle(() => {
//     console.log('bbb inner size style', innerScale.value, closingDown.value)
//     return {
//       transform: [{translateY: innerOffsetY.value + (locked ? 0 : dragY.value)}, {scale: innerScale.value}],
//     }
//   })
//   const upArrowStyle = useAnimatedStyle(() => ({
//     opacity: initialBounce.value,
//     transform: [{translateY: interpolate(initialBounce.value, [0, 1], [180, 0])}],
//   }))
//   const lockStyle = useAnimatedStyle(() => ({
//     opacity: initialBounce.value,
//     transform: [
//       {translateY: interpolate(initialBounce.value, [0, 1], [180, 0])},
//       {translateY: interpolate(dragY.value, [-70, 0], [-10, 0])},
//     ],
//   }))
//   const arrowFullUpStyle = useAnimatedStyle(() => ({
//     opacity: initialBounce.value,
//     transform: [{translateY: interpolate(sendTranslate.value, [0, 1], [180, 0])}],
//   }))
//   const micStyle = useAnimatedStyle(() => ({
//     transform: [{translateY: micOffsetY.value + dragY.value}],
//   }))

//   return (
//     <>
//       {locked ? (
//         <Animated.View style={[{bottom: 130, position: 'absolute', right: 42}, arrowFullUpStyle]}>
//           <View
//             style={{
//               alignItems: 'center',
//               backgroundColor: Styles.globalColors.blue,
//               borderRadius: 16,
//               height: 32,
//               justifyContent: 'center',
//               width: 32,
//             }}
//           >
//             <Kb.ClickableBox
//               onClick={sendRecording}
//               style={{alignItems: 'center', height: 32, justifyContent: 'center', width: 32}}
//             >
//               <Kb.Icon
//                 color={Styles.globalColors.whiteOrWhite}
//                 sizeType="Small"
//                 type="iconfont-arrow-full-up"
//               />
//             </Kb.ClickableBox>
//           </View>
//         </Animated.View>
//       ) : (
//         <>
//         </>
//       )}

//       {!locked ? (
//         <Animated.View style={[{position: 'absolute', right: 44, top: -4}, micStyle]}>
//           <Kb.Icon type="iconfont-mic" color={Styles.globalColors.whiteOrWhite} />
//         </Animated.View>
//       ) : (
//         <View
//           style={{
//             bottom: 22,
//             height: 48,
//             justifyContent: 'center',
//             position: 'absolute',
//             right: 19,
//             width: 48,
//           }}
//         >
//           <Kb.Icon type="iconfont-stop" color={Styles.globalColors.whiteOrWhite} onClick={stageRecording} />
//         </View>
//       )}
//     </>
//   )
// }

// type CancelProps = {
//   closingDown: SharedValue<number>
//   locked: boolean
//   onCancel: () => void
//   translate: SharedValue<number>
// }

// const AudioSlideToCancel = (props: CancelProps) => {
//   const cancelTranslate = useSharedValue(0)
//   const {closingDown, translate, locked, onCancel} = props
//   React.useEffect(() => {
//     if (closingDown.value) {
//       cancelTranslate.value = withTiming(1)
//     }
//   }, [closingDown, cancelTranslate])

//   const cancelStyle = useAnimatedStyle(() => ({
//     transform: [{translateY: interpolate(cancelTranslate.value, [0, 1], [0, 85])}],
//   }))
//   const transStyle = useAnimatedStyle(() => ({
//     opacity: translate.value,
//     transform: [{translateX: interpolate(translate.value, [0, 1], [-10, -125])}],
//   }))

//   return locked ? (
//     <Animated.View style={[{bottom: 27, left: 100, position: 'absolute'}, cancelStyle]}>
//       <Kb.ClickableBox onClick={onCancel} style={{alignItems: 'center', height: 30}}>
//         <Kb.Text type="BodyBigLink">Cancel</Kb.Text>
//       </Kb.ClickableBox>
//     </Animated.View>
//   ) : (
//     <Animated.View
//       pointerEvents="box-none"
//       style={[{bottom: 35, position: 'absolute', right: 0}, transStyle]}
//     >
//       <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
//         <Kb.Icon sizeType="Tiny" type="iconfont-arrow-left" />
//         <Kb.Text type="BodySmall" onClick={onCancel}>
//           Slide to cancel
//         </Kb.Text>
//       </Kb.Box2>
//     </Animated.View>
//   )
// }

// type CounterProps = {
//   initialBounce: SharedValue<number>
// }

// const AudioCounter = (props: CounterProps) => {
//   const {initialBounce} = props
//   const [seconds, setSeconds] = React.useState(0)
//   const [startTime] = React.useState(Date.now())
//   React.useEffect(() => {
//     const timer = setTimeout(() => {
//       setSeconds((Date.now() - startTime) / 1000)
//     }, 1000)
//     return () => clearTimeout(timer)
//   }, [seconds, startTime])
//   const durationStyle = useAnimatedStyle(() => ({
//     opacity: initialBounce.value,
//   }))
//   return (
//     <Animated.View style={[{bottom: 35, left: 10, position: 'absolute'}, durationStyle]}>
//       <Kb.Text type="BodyBold">{formatAudioRecordDuration(seconds * 1000)}</Kb.Text>
//     </Animated.View>
//   )
// }

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
  },
  lockHintStyle: {
    ...centerAroundIcon(32),
    alignItems: 'center',
  },
}))

export default AudioRecorder
