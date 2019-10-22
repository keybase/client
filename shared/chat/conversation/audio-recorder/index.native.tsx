import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Types from '../../../constants/types/chat2'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {formatAudioRecordDuration} from '../../../util/timestamp'
import {Props} from '.'

const minAmp = -100

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
  const noShow =
    !audioRecording ||
    audioRecording.status === Types.AudioRecordingStatus.STOPPED ||
    audioRecording.status === Types.AudioRecordingStatus.STAGED
  // dispatch
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.CANCEL}))
  }
  const startRecording = (meteringCb: (n: number) => void) => {
    dispatch(Chat2Gen.createStartAudioRecording({conversationIDKey, meteringCb}))
  }
  const sendRecording = () => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.SEND}))
  }
  const stageRecording = () => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.STOPBUTTON}))
  }
  // lifecycle
  React.useEffect(() => {
    if (audioRecording && audioRecording.status === Types.AudioRecordingStatus.INITIAL) {
      startRecording(setLastAmp)
    }
  }, [audioRecording])

  // render
  if (!visible && !noShow) {
    setVisible(true)
    setClosingDown(false)
  } else if (visible && noShow && !closingDown) {
    setClosingDown(true)
    setTimeout(() => setVisible(false), 200)
  }
  const locked = audioRecording ? audioRecording.status === Types.AudioRecordingStatus.LOCKED : false
  return !visible ? null : (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
      <AudioButton
        closeDown={closingDown}
        locked={locked}
        lastAmp={lastAmp}
        sendRecording={sendRecording}
        stageRecording={stageRecording}
      />
      <Kb.Box2 gap="medium" direction="horizontal" style={styles.rowContainer}>
        <AudioCounter />
        <AudioSlideToCancel locked={locked} onCancel={onCancel} />
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
  return Math.max(3, (1 - amp / minAmp) * 7)
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
          duration: 200,
          toValue: 3,
          useNativeDriver: true,
        }),
        Kb.NativeAnimated.timing(outerScale, {
          duration: 200,
          toValue: 15,
          useNativeDriver: true,
        }),
        Kb.NativeAnimated.timing(lockTranslate, {
          duration: 200,
          toValue: 1,
          useNativeDriver: true,
        }),
        Kb.NativeAnimated.timing(ampScale, {
          duration: 200,
          toValue: 3,
          useNativeDriver: true,
        }),
      ],
      {stopTogether: false}
    ).start()
  }, [])
  React.useEffect(() => {
    if (!props.closeDown && props.lastAmp >= minAmp) {
      Kb.NativeAnimated.timing(ampScale, {
        duration: 200,
        toValue: ampToScale(props.lastAmp),
        useNativeDriver: true,
      }).start()
    }
  }, [props.lastAmp])
  React.useEffect(() => {
    if (props.locked) {
      Kb.NativeAnimated.timing(sendTranslate, {
        duration: 200,
        toValue: 1,
        useNativeDriver: true,
      }).start()
    }
  }, [props.locked])
  React.useEffect(() => {
    if (props.closeDown) {
      Kb.NativeAnimated.parallel(
        [
          Kb.NativeAnimated.timing(innerScale, {
            duration: 200,
            toValue: 0,
            useNativeDriver: true,
          }),
          Kb.NativeAnimated.timing(ampScale, {
            duration: 200,
            toValue: 0,
            useNativeDriver: true,
          }),
          Kb.NativeAnimated.timing(lockTranslate, {
            duration: 200,
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
          height: outerSize,
          width: outerSize,
          borderRadius: outerSize / 2,
          backgroundColor: Styles.globalColors.white,
          position: 'absolute',
          bottom: 20,
          right: 30,
          opacity: 0.9,
          transform: [
            {
              scale: outerScale,
            },
          ],
        }}
      />
      <Kb.NativeAnimated.View
        style={{
          height: ampSize,
          width: ampSize,
          borderRadius: ampSize / 2,
          backgroundColor: props.locked ? Styles.globalColors.redLight : Styles.globalColors.blueLighter,
          position: 'absolute',
          bottom: 15,
          right: 40,
          transform: [
            {
              scale: ampScale,
            },
          ],
        }}
      />
      <Kb.NativeAnimated.View
        style={{
          height: innerSize,
          width: innerSize,
          borderRadius: innerSize / 2,
          backgroundColor: props.locked ? Styles.globalColors.red : Styles.globalColors.blue,
          position: 'absolute',
          bottom: 17,
          right: 43,
          transform: [
            {
              scale: innerScale,
            },
          ],
        }}
      />

      {!props.locked ? (
        <Kb.NativeAnimated.View
          style={{
            position: 'absolute',
            right: 45,
            bottom: 100,
            opacity: lockTranslate,
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
            position: 'absolute',
            right: 42,
            bottom: 100,
            opacity: sendTranslate,
            transform: [{translateY: sendTranslate.interpolate({inputRange: [0, 1], outputRange: [150, 0]})}],
          }}
        >
          <Kb.NativeView
            style={{
              alignItems: 'center',
              height: 32,
              width: 32,
              borderRadius: 16,
              backgroundColor: Styles.globalColors.blue,
              justifyContent: 'center',
            }}
          >
            <Kb.ClickableBox onClick={props.sendRecording}>
              <Kb.Box2 direction="vertical" centerChildren={true}>
                <Kb.Icon type="iconfont-arrow-full-up" color={Styles.globalColors.white} fontSize={22} />
              </Kb.Box2>
            </Kb.ClickableBox>
          </Kb.NativeView>
        </Kb.NativeAnimated.View>
      )}

      {!props.locked ? (
        <Kb.Icon
          type="iconfont-star"
          fontSize={22}
          color={Styles.globalColors.white}
          style={{position: 'absolute', bottom: 19, right: 46}}
        />
      ) : (
        <Kb.TapGestureHandler onHandlerStateChange={props.stageRecording}>
          <Kb.NativeView
            style={{
              height: 48,
              width: 48,
              position: 'absolute',
              justifyContent: 'center',
              bottom: 8,
              right: 18,
            }}
          >
            <Kb.Box
              style={{
                backgroundColor: Styles.globalColors.white,
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
  locked: boolean
  onCancel: () => void
}

const AudioSlideToCancel = (props: CancelProps) => {
  const translate = React.useRef(new Kb.NativeAnimated.Value(0)).current
  React.useEffect(() => {
    Kb.NativeAnimated.timing(translate, {
      duration: 200,
      toValue: 1,
      useNativeDriver: true,
    }).start()
  }, [])
  return props.locked ? (
    <Kb.Text type="BodyPrimaryLink" onClick={props.onCancel} style={{marginLeft: 30}}>
      Cancel
    </Kb.Text>
  ) : (
    <Kb.NativeAnimated.View
      style={{
        transform: [{translateX: translate.interpolate({inputRange: [0, 1], outputRange: [150, 0]})}],
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
