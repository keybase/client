/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {formatAudioRecordDuration} from '../../../util/timestamp'
import {Props} from '.'

const minAmp = -80

const AudioRecorder = (props: Props) => {
  // props
  const {conversationIDKey} = props
  // state
  const [lastAmp, setLastAmp] = React.useState(minAmp - 1)
  const [visible, setVisible] = React.useState(false)
  const [closingDown, setClosingDown] = React.useState(false)
  const {audioRecording} = Container.useSelector(state => ({
    audioRecording: state.chat2.audioRecording.get(conversationIDKey),
  }))
  const timerRef = React.useRef<NodeJS.Timeout | null>(null)

  // dispatch
  const dispatch = Container.useDispatch()
  const onCancel = React.useCallback(() => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.CANCEL}))
  }, [dispatch, conversationIDKey])
  const startRecording = React.useCallback(
    (meteringCb: (n: number) => void) => {
      dispatch(Chat2Gen.createStartAudioRecording({conversationIDKey, meteringCb}))
    },
    [dispatch, conversationIDKey]
  )
  const sendRecording = React.useCallback(() => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.SEND}))
  }, [dispatch, conversationIDKey])
  const stageRecording = React.useCallback(() => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.STOPBUTTON}))
  }, [dispatch, conversationIDKey])

  // lifecycle
  React.useEffect(() => {
    // we only want one of these timers running ever, so keep track of it here. We clear the timeout
    // whenever we drop the audio recording interface from the conv
    if (!timerRef.current && audioRecording && audioRecording.status === Types.AudioRecordingStatus.INITIAL) {
      timerRef.current = setTimeout(() => startRecording(setLastAmp), 400)
    } else if (!Constants.showAudioRecording(audioRecording) && timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [audioRecording])

  // render
  const noShow = !Constants.showAudioRecording(audioRecording)
  if (!visible && !noShow) {
    setVisible(true)
    setClosingDown(false)
  } else if (visible && noShow && !closingDown) {
    setClosingDown(true)
    setTimeout(() => setVisible(false), 400)
  }
  const locked = audioRecording ? audioRecording.isLocked : false
  return !visible ? null : (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
      <AudioButton
        closeDown={closingDown}
        lastAmp={lastAmp}
        locked={locked}
        sendRecording={sendRecording}
        stageRecording={stageRecording}
      />
      {!locked && <AudioSlideToCancel closeDown={closingDown} onCancel={onCancel} />}
      <Kb.Box2 gap="medium" direction="horizontal" style={styles.rowContainer}>
        <AudioCounter />
        {locked && (
          <Kb.Text type="BodyPrimaryLink" onClick={onCancel} style={{marginLeft: 30}}>
            Cancel
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

type ButtonProps = {
  closeDown: boolean
  lastAmp: number
  locked: boolean
  sendRecording: () => void
  stageRecording: () => void
}

const ampToScale = (amp: number) => {
  return Math.max(3, (1 - amp / minAmp) * 8)
}

const AudioButton = (props: ButtonProps) => {
  const innerScale = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const ampScale = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const outerScale = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const lockTranslate = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const sendTranslate = React.useRef(new Kb.NativeAnimated.Value(0)).current
  // lifecycle
  React.useEffect(() => {
    Kb.NativeAnimated.parallel(
      [
        Kb.NativeAnimated.timing(innerScale, {
          easing: Kb.NativeEasing.elastic(1),
          duration: 400,
          toValue: 3,
          useNativeDriver: true,
        }),
        Kb.NativeAnimated.timing(outerScale, {
          duration: 400,
          toValue: 15,
          useNativeDriver: true,
        }),
        Kb.NativeAnimated.timing(lockTranslate, {
          easing: Kb.NativeEasing.elastic(1),
          duration: 400,
          toValue: 1,
          useNativeDriver: true,
        }),
      ],
      {stopTogether: false}
    ).start()
  }, [])
  React.useEffect(() => {
    if (!props.closeDown && props.lastAmp >= minAmp) {
      Kb.NativeAnimated.timing(ampScale, {
        duration: 250,
        toValue: ampToScale(props.lastAmp),
        useNativeDriver: true,
      }).start()
    }
  }, [props.closeDown, props.lastAmp])
  React.useEffect(() => {
    if (props.locked) {
      Kb.NativeAnimated.timing(sendTranslate, {
        duration: 400,
        toValue: 1,
        useNativeDriver: true,
      }).start()
    }
  }, [props.locked])
  React.useEffect(() => {
    if (props.closeDown) {
      Kb.NativeAnimated.parallel(
        [
          Kb.NativeAnimated.timing(outerScale, {
            duration: 400,
            toValue: 0,
            useNativeDriver: true,
          }),
          Kb.NativeAnimated.timing(innerScale, {
            duration: 400,
            toValue: 0,
            useNativeDriver: true,
          }),
          Kb.NativeAnimated.timing(ampScale, {
            duration: 400,
            toValue: 0,
            useNativeDriver: true,
          }),
          Kb.NativeAnimated.timing(lockTranslate, {
            duration: 400,
            toValue: 0,
            useNativeDriver: true,
          }),
          Kb.NativeAnimated.timing(sendTranslate, {
            duration: 400,
            toValue: 0,
            useNativeDriver: true,
          }),
        ],
        {stopTogether: false}
      ).start()
    }
  }, [props.closeDown])

  const innerSize = 28
  const ampSize = 34
  const outerSize = 50
  return (
    <>
      <Kb.NativeAnimated.View
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
          bottom: 15,
          height: ampSize,
          position: 'absolute',
          right: 40,
          transform: [
            {
              scale: ampScale,
            },
          ],
          width: ampSize,
        }}
      />
      <Kb.NativeAnimated.View
        style={{
          backgroundColor: props.locked ? Styles.globalColors.red : Styles.globalColors.blue,
          borderRadius: innerSize / 2,
          bottom: 17,
          height: innerSize,
          position: 'absolute',
          right: 43,
          transform: [
            {
              scale: innerScale,
            },
          ],
          width: innerSize,
        }}
      />

      {!props.locked ? (
        <Kb.NativeAnimated.View
          style={{
            bottom: 100,
            opacity: lockTranslate,
            position: 'absolute',
            right: 45,
            transform: [{translateY: lockTranslate.interpolate({inputRange: [0, 1], outputRange: [150, 0]})}],
          }}
        >
          <Kb.NativeView>
            <Kb.Box2 direction="vertical">
              <Kb.Icon type="iconfont-arrow-up" fontSize={22} />
              <Kb.Icon type="iconfont-lock" fontSize={22} />
            </Kb.Box2>
          </Kb.NativeView>
        </Kb.NativeAnimated.View>
      ) : (
        <Kb.NativeAnimated.View
          style={{
            bottom: 100,
            opacity: sendTranslate,
            position: 'absolute',
            right: 42,
            transform: [{translateY: sendTranslate.interpolate({inputRange: [0, 1], outputRange: [150, 0]})}],
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
            <Kb.ClickableBox onClick={props.sendRecording}>
              <Kb.Box2 direction="vertical" centerChildren={true}>
                <Kb.Icon
                  type="iconfont-arrow-full-up"
                  color={Styles.globalColors.whiteOrWhite}
                  fontSize={22}
                />
              </Kb.Box2>
            </Kb.ClickableBox>
          </Kb.NativeView>
        </Kb.NativeAnimated.View>
      )}

      {!props.locked ? (
        <Kb.Icon
          type="iconfont-mic"
          fontSize={22}
          color={Styles.globalColors.whiteOrWhite}
          style={{bottom: 13, position: 'absolute', right: 46}}
        />
      ) : (
        <Kb.TapGestureHandler onHandlerStateChange={props.stageRecording}>
          <Kb.NativeView
            style={{
              bottom: 8,
              height: 48,
              justifyContent: 'center',
              position: 'absolute',
              right: 18,
              width: 48,
            }}
          >
            <Kb.Box
              style={{
                backgroundColor: Styles.globalColors.whiteOrWhite,
                borderRadius: 2,
                height: 18,
                width: 18,
              }}
            />
          </Kb.NativeView>
        </Kb.TapGestureHandler>
      )}
    </>
  )
}

type CancelProps = {
  closeDown: boolean
  onCancel: () => void
}

const AudioSlideToCancel = (props: CancelProps) => {
  const translate = React.useRef(new Kb.NativeAnimated.Value(0)).current
  React.useEffect(() => {
    Kb.NativeAnimated.timing(translate, {
      easing: Kb.NativeEasing.elastic(1),
      duration: 400,
      toValue: 1,
      useNativeDriver: true,
    }).start()
  }, [])
  React.useEffect(() => {
    if (props.closeDown) {
      Kb.NativeAnimated.timing(translate, {
        duration: 400,
        toValue: 0,
        useNativeDriver: true,
      }).start()
    }
  }, [props.closeDown])
  return (
    <Kb.NativeAnimated.View
      style={{
        bottom: 10,
        position: 'absolute',
        right: 0,
        transform: [
          {
            translateX: translate.interpolate({
              inputRange: [0, 1],
              outputRange: [-10, -120],
            }),
          },
        ],
      }}
    >
      <Kb.Box2 direction="horizontal" gap="tiny">
        <Kb.Icon type="iconfont-arrow-left" fontSize={16} />
        <Kb.Text type="BodySecondaryLink">Slide to cancel</Kb.Text>
      </Kb.Box2>
    </Kb.NativeAnimated.View>
  )
}

const AudioCounter = () => {
  const [seconds, setSeconds] = React.useState(0)
  React.useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(seconds + 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [seconds])
  return <Kb.Text type="BodyBold">{formatAudioRecordDuration(seconds * 1000)}</Kb.Text>
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.fillAbsolute,
    justifyContent: 'flex-end',
    padding: Styles.globalMargins.tiny + 3,
  },
  rowContainer: {
    alignSelf: 'flex-start',
  },
}))

export default AudioRecorder
