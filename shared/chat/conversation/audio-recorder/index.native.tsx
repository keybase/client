import * as React from 'react'
import * as Kb from '../../../common-adapters/mobile.native'
import * as Types from '../../../constants/types/chat2'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {formatAudioRecordDuration} from '../../../util/timestamp'
import {Props} from '.'

const AudioRecorder = (props: Props) => {
  // props
  const {conversationIDKey} = props
  // state
  const {audioRecording} = Container.useSelector(state => ({
    audioRecording: state.chat2.audioRecording.get(conversationIDKey),
  }))
  // dispatch
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, lockOverride: true}))
  }
  const locked = audioRecording ? audioRecording.status === Types.AudioRecordingStatus.LOCKED : false
  return !audioRecording ? null : (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
      <AudioButton locked={locked} />
      <Kb.Box2 gap="medium" direction="horizontal" fullWidth={true} style={styles.rowContainer}>
        <AudioCounter />
        <AudioSlideToCancel locked={locked} onCancel={onCancel} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

type ButtonProps = {
  locked: boolean
}

const AudioButton = (props: ButtonProps) => {
  const innerScale = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const outerScale = React.useRef(new Kb.NativeAnimated.Value(0)).current
  const lockTranslate = new Kb.NativeAnimated.Value(0)
  React.useEffect(() => {
    Kb.NativeAnimated.timing(innerScale, {
      duration: 200,
      toValue: 4,
    }).start()
    Kb.NativeAnimated.timing(outerScale, {
      duration: 200,
      toValue: 15,
    }).start()
    Kb.NativeAnimated.timing(lockTranslate, {
      duration: 200,
      toValue: 1,
    }).start()
    return () => {
      Kb.NativeAnimated.timing(innerScale, {
        duration: 200,
        toValue: 0,
      }).start()
      Kb.NativeAnimated.timing(outerScale, {
        duration: 200,
        toValue: 0,
      }).start()
    }
  }, [])

  const innerSize = 28
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
          height: innerSize,
          width: innerSize,
          borderRadius: innerSize / 2,
          backgroundColor: props.locked ? Styles.globalColors.red : Styles.globalColors.blue,
          position: 'absolute',
          bottom: 10,
          right: 43,
          transform: [
            {
              scale: innerScale,
            },
          ],
        }}
      />
      <Kb.NativeAnimated.View
        style={{
          position: 'absolute',
          right: 45,
          bottom: 110,
          opacity: lockTranslate,
          transform: [{translateY: lockTranslate.interpolate({inputRange: [0, 1], outputRange: [50, 0]})}],
        }}
      >
        <Kb.NativeView>
          <Kb.Box2 direction="vertical">
            <Kb.Icon type="iconfont-arrow-up" fontSize={22} />
            <Kb.Icon type="iconfont-lock" fontSize={22} />
          </Kb.Box2>
        </Kb.NativeView>
      </Kb.NativeAnimated.View>
      {!props.locked ? (
        <Kb.Icon
          type="iconfont-star"
          fontSize={22}
          color={Styles.globalColors.white}
          style={{position: 'absolute', bottom: 12, right: 46}}
        />
      ) : (
        <Kb.NativeView
          style={{
            backgroundColor: Styles.globalColors.white,
            borderRadius: 2,
            height: 18,
            width: 18,
            position: 'absolute',
            bottom: 15,
            right: 49,
          }}
        />
      )}
    </>
  )
}

type CancelProps = {
  locked: boolean
  onCancel: () => void
}

const AudioSlideToCancel = (props: CancelProps) => {
  return props.locked ? (
    <Kb.Text type="BodyPrimaryLink" onClick={props.onCancel} style={{marginLeft: 30}}>
      Cancel
    </Kb.Text>
  ) : (
    <Kb.Box2 direction="horizontal" gap="tiny">
      <Kb.Icon type="iconfont-arrow-left" fontSize={16} />
      <Kb.Text type="BodySecondaryLink">Slide to cancel</Kb.Text>
    </Kb.Box2>
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
    alignItems: 'center',
  },
}))

export default AudioRecorder
