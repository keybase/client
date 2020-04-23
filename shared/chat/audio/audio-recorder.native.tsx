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
import {Gateway} from '@chardskarth/react-gateway'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  iconStyle?: Kb.IconStyle
}

const unifyAmp = (amp: number) => {
  return isIOS ? 10 ** (amp * 0.05) : Math.min(1.0, amp / 22000)
}

const AudioRecorder = (props: Props) => {
  // props
  const {conversationIDKey} = props
  // state
  const ampScale = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const dragY = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const slideTranslate = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const ampTracker = React.useRef(new AmpTracker()).current
  const [visible, setVisible] = React.useState(false)
  const [closingDown, setClosingDown] = React.useState(false)
  const audioRecording = Container.useSelector(state => state.chat2.audioRecording.get(conversationIDKey))
  const closingDownRef = React.useRef(false)

  // dispatch
  const dispatch = Container.useDispatch()
  const meteringCb = React.useCallback(
    (inamp: number) => {
      const amp = unifyAmp(inamp)
      ampTracker.addAmp(amp)
      if (!closingDownRef.current) {
        Kb.NativeAnimated.timing(ampScale, {
          duration: 100,
          toValue: ampToScale(amp),
          useNativeDriver: true,
        }).start()
      }
    },
    [ampTracker, ampScale]
  )
  const onCancel = React.useCallback(() => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.CANCEL}))
  }, [dispatch, conversationIDKey])
  const lockRecording = React.useCallback(() => {
    dispatch(Chat2Gen.createLockAudioRecording({conversationIDKey}))
  }, [dispatch, conversationIDKey])
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
  const stageRecording = React.useCallback(() => stopRecording(Types.AudioStopType.STOPBUTTON), [
    stopRecording,
  ])

  // render
  const noShow = !Constants.showAudioRecording(audioRecording)
  if (!visible && !noShow) {
    closingDownRef.current = false
    setVisible(true)
    setClosingDown(false)
  } else if (visible && noShow && !closingDown) {
    closingDownRef.current = true
    setClosingDown(true)
    setTimeout(() => setVisible(false), 500)
  }
  const locked = audioRecording ? audioRecording.isLocked : false
  const recording =
    !!audioRecording &&
    (audioRecording.status === Types.AudioRecordingStatus.INITIAL ||
      audioRecording.status === Types.AudioRecordingStatus.RECORDING)
  return (
    <>
      <AudioStarter
        dragY={dragY}
        locked={locked}
        lockRecording={lockRecording}
        recording={recording}
        enableRecording={enableRecording}
        stopRecording={stopRecording}
        iconStyle={props.iconStyle}
      />
      {!visible ? null : (
        <Gateway into="convOverlay">
          <Kb.Box2
            direction="vertical"
            fullHeight={true}
            fullWidth={true}
            style={styles.container}
            pointerEvents="box-none"
          >
            <AudioButton
              ampScale={ampScale}
              closeDown={closingDown}
              dragY={dragY}
              locked={locked}
              sendRecording={sendRecording}
              slideTranslate={slideTranslate}
              stageRecording={stageRecording}
            />
            <AudioSlideToCancel
              closeDown={closingDown}
              locked={locked}
              onCancel={onCancel}
              translate={slideTranslate}
            />
            <AudioCounter closeDown={closingDown} slideTranslate={slideTranslate} />
          </Kb.Box2>
        </Gateway>
      )}
    </>
  )
}

type ButtonProps = {
  ampScale: Kb.NativeAnimated.Value
  closeDown: boolean
  dragY: Kb.NativeAnimated.Value
  locked: boolean
  sendRecording: () => void
  slideTranslate: Kb.NativeAnimated.Value
  stageRecording: () => void
}

const maxScale = 8
const minScale = 3
const ampToScale = (amp: number) => {
  return minScale + amp * (maxScale - minScale)
}

const AudioButton = (props: ButtonProps) => {
  const {slideTranslate, locked, closeDown, ampScale} = props
  const innerScale = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const outerScale = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const sendTranslate = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const innerOffsetY = React.useRef(new Kb.NativeAnimated.Value(-34)).current
  const ampOffsetY = React.useRef(new Kb.NativeAnimated.Value(-31)).current
  const micOffsetY = React.useRef(new Kb.NativeAnimated.Value(-34)).current
  // lifecycle
  React.useEffect(() => {
    Kb.NativeAnimated.parallel(
      [
        Kb.NativeAnimated.timing(innerScale, {
          easing: Kb.NativeEasing.elastic(1),
          toValue: 3,
          useNativeDriver: true,
        }),
        Kb.NativeAnimated.timing(outerScale, {
          duration: 200,
          easing: Kb.NativeEasing.inOut(Kb.NativeEasing.ease),
          toValue: Styles.isTablet ? 40 : 15,
          useNativeDriver: true,
        }),
        Kb.NativeAnimated.timing(slideTranslate, {
          easing: Kb.NativeEasing.elastic(1),
          toValue: 1,
          useNativeDriver: true,
        }),
      ],
      {stopTogether: false}
    ).start()
  }, [innerScale, outerScale, slideTranslate])
  React.useEffect(() => {
    if (locked) {
      Kb.NativeAnimated.timing(sendTranslate, {
        easing: Kb.NativeEasing.elastic(1),
        toValue: 1,
        useNativeDriver: true,
      }).start()
    }
  }, [locked, sendTranslate])
  React.useEffect(() => {
    if (closeDown) {
      Kb.NativeAnimated.parallel(
        [
          Kb.NativeAnimated.timing(outerScale, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Kb.NativeAnimated.timing(innerScale, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Kb.NativeAnimated.timing(slideTranslate, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Kb.NativeAnimated.timing(sendTranslate, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Kb.NativeAnimated.timing(ampScale, {
            toValue: 0,
            useNativeDriver: true,
          }),
        ],
        {stopTogether: false}
      ).start()
    }
  }, [closeDown, innerScale, outerScale, slideTranslate, sendTranslate, ampScale])

  const innerSize = 28
  const ampSize = 34
  const outerSize = 50
  return (
    <>
      <Kb.NativeAnimated.View
        pointerEvents="box-none"
        style={{
          backgroundColor: Styles.globalColors.white,
          borderRadius: outerSize / 2,
          bottom: 20,
          height: outerSize,
          opacity: 0.9,
          position: 'absolute',
          right: 30,
          transform: [
            {
              scale: outerScale,
            },
          ],
          width: outerSize,
        }}
      />
      <Kb.NativeAnimated.View
        style={{
          backgroundColor: props.locked
            ? Styles.globalColors.redLight
            : Styles.globalColors.blueLighterOrBlueLight,
          borderRadius: ampSize / 2,
          height: ampSize,
          position: 'absolute',
          right: 40,
          transform: [{translateY: Kb.NativeAnimated.add(ampOffsetY, props.dragY)}, {scale: props.ampScale}],
          width: ampSize,
        }}
      />
      <Kb.NativeAnimated.View
        style={{
          backgroundColor: props.locked ? Styles.globalColors.red : Styles.globalColors.blue,
          borderRadius: innerSize / 2,
          height: innerSize,
          position: 'absolute',
          right: 43,
          transform: [{translateY: Kb.NativeAnimated.add(innerOffsetY, props.dragY)}, {scale: innerScale}],
          width: innerSize,
        }}
      />

      {!props.locked ? (
        <>
          <Kb.NativeAnimated.View
            style={{
              bottom: 160,
              opacity: props.slideTranslate,
              position: 'absolute',
              right: 50,
              transform: [
                {
                  translateY: props.slideTranslate.interpolate({
                    inputRange: [0, 1],
                    outputRange: [180, 0],
                  }),
                },
              ],
            }}
          >
            <Kb.NativeView>
              <Kb.Icon type="iconfont-arrow-up" sizeType="Tiny" />
            </Kb.NativeView>
          </Kb.NativeAnimated.View>
          <Kb.NativeAnimated.View
            style={{
              bottom: 130,
              opacity: props.slideTranslate,
              position: 'absolute',
              right: 45,
              transform: [
                {
                  translateY: props.slideTranslate.interpolate({
                    inputRange: [0, 1],
                    outputRange: [180, 0],
                  }),
                },
                {
                  translateY: props.dragY.interpolate({
                    inputRange: [-70, 0],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            }}
          >
            <Kb.Icon type="iconfont-lock" />
          </Kb.NativeAnimated.View>
        </>
      ) : (
        <Kb.NativeAnimated.View
          style={{
            bottom: 130,
            opacity: sendTranslate,
            position: 'absolute',
            right: 42,
            transform: [{translateY: sendTranslate.interpolate({inputRange: [0, 1], outputRange: [180, 0]})}],
          }}
        >
          <Kb.NativeView
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
              onClick={props.sendRecording}
              style={{alignItems: 'center', height: 32, justifyContent: 'center', width: 32}}
            >
              <Kb.Icon
                color={Styles.globalColors.whiteOrWhite}
                sizeType="Small"
                type="iconfont-arrow-full-up"
              />
            </Kb.ClickableBox>
          </Kb.NativeView>
        </Kb.NativeAnimated.View>
      )}

      {!props.locked ? (
        <Kb.NativeAnimated.View
          style={{
            position: 'absolute',
            right: 44,
            top: -4,
            transform: [{translateY: Kb.NativeAnimated.add(micOffsetY, props.dragY)}],
          }}
        >
          <Kb.Icon type="iconfont-mic" color={Styles.globalColors.whiteOrWhite} />
        </Kb.NativeAnimated.View>
      ) : (
        <Kb.TapGestureHandler onHandlerStateChange={props.stageRecording}>
          <Kb.NativeView
            style={{
              bottom: 22,
              height: 48,
              justifyContent: 'center',
              position: 'absolute',
              right: 19,
              width: 48,
            }}
          >
            <Kb.Icon type="iconfont-stop" color={Styles.globalColors.whiteOrWhite} />
          </Kb.NativeView>
        </Kb.TapGestureHandler>
      )}
    </>
  )
}

type CancelProps = {
  closeDown: boolean
  locked: boolean
  onCancel: () => void
  translate: Kb.NativeAnimated.Value
}

const AudioSlideToCancel = (props: CancelProps) => {
  const cancelTranslate = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const {closeDown} = props
  React.useEffect(() => {
    if (closeDown) {
      Kb.NativeAnimated.timing(cancelTranslate, {
        toValue: 1,
        useNativeDriver: true,
      }).start()
    }
  }, [closeDown, cancelTranslate])
  return props.locked ? (
    <Kb.NativeAnimated.View
      style={{
        bottom: 27,
        left: 100,
        position: 'absolute',
        transform: [
          {
            translateY: cancelTranslate.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 85],
            }),
          },
        ],
      }}
    >
      <Kb.ClickableBox onClick={props.onCancel} style={{alignItems: 'center', height: 30}}>
        <Kb.Text type="BodyBigLink">Cancel</Kb.Text>
      </Kb.ClickableBox>
    </Kb.NativeAnimated.View>
  ) : (
    <Kb.NativeAnimated.View
      pointerEvents="box-none"
      style={{
        bottom: 35,
        opacity: props.translate,
        position: 'absolute',
        right: 0,
        transform: [
          {
            translateX: props.translate.interpolate({
              inputRange: [0, 1],
              outputRange: [-10, -125],
            }),
          },
        ],
      }}
    >
      <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true}>
        <Kb.Icon sizeType="Tiny" type="iconfont-arrow-left" />
        <Kb.Text type="BodySmall" onClick={props.onCancel}>
          Slide to cancel
        </Kb.Text>
      </Kb.Box2>
    </Kb.NativeAnimated.View>
  )
}

type CounterProps = {
  closeDown: boolean
  slideTranslate: Kb.NativeAnimated.Value
}

const AudioCounter = (props: CounterProps) => {
  const [seconds, setSeconds] = React.useState(0)
  const [startTime] = React.useState(Date.now())
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSeconds((Date.now() - startTime) / 1000)
    }, 1000)
    return () => clearTimeout(timer)
  }, [seconds, startTime])
  return (
    <Kb.NativeAnimated.View
      style={{
        bottom: 35,
        left: 10,
        opacity: props.slideTranslate,
        position: 'absolute',
      }}
    >
      <Kb.Text type="BodyBold">{formatAudioRecordDuration(seconds * 1000)}</Kb.Text>
    </Kb.NativeAnimated.View>
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
