import React from 'react'
import * as Types from '../../constants/types/chat2'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/chat2'
import AudioPlayer from './audio-player'

type Props = {
  conversationIDKey: Types.ConversationIDKey
}

const AudioSend = (props: Props) => {
  // props
  const {conversationIDKey} = props
  // state
  const {audioRecording} = Container.useSelector(state => ({
    audioRecording: state.chat2.audioRecording.get(conversationIDKey),
  }))
  // dispatch
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.CANCEL}))
  }
  const onSend = () => {
    if (audioRecording) {
      dispatch(Chat2Gen.createSendAudioRecording({conversationIDKey, fromStaged: true, info: audioRecording}))
    }
  }

  // render
  let player = <Kb.Text type="Body">No recording available</Kb.Text>
  if (audioRecording) {
    const audioUrl = `file://${audioRecording.path}`
    const duration = Constants.audioRecordingDuration(audioRecording)
    player = (
      <AudioPlayer
        duration={duration}
        maxWidth={120}
        url={audioUrl}
        visAmps={audioRecording.amps ? audioRecording.amps.getBucketedAmps(duration) : []}
      />
    )
  }
  return (
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" gap="medium" alignItems="center">
        <Kb.Icon type="iconfont-remove" onClick={onCancel} />
        {player}
      </Kb.Box2>
      <Kb.Button type="Default" small={true} style={styles.send} onClick={onSend} label="Send" />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    alignItems: 'center',
    borderStyle: 'solid',
    borderTopColor: Styles.globalColors.black_10,
    borderTopWidth: 1,
    justifyContent: 'space-between',
    padding: Styles.globalMargins.tiny,
  },
  send: {
    alignSelf: 'flex-end',
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
}))

export default AudioSend
