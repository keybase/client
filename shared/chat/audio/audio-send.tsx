import React from 'react'
import * as Types from '../../constants/types/chat2'
import * as Container from '../../util/container'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  conversationIDKey: Types.ConversationIDKey
}

const AudioSend = (props: Props) => {
  // props
  const {conversationIDKey} = props
  // dispatch
  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.CANCEL}))
  }
  const onSend = () => {
    dispatch(Chat2Gen.createSendAudioRecording({conversationIDKey}))
  }

  // render
  return (
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true}>
      <Kb.Icon type="iconfont-remove" fontSize={22} onClick={onCancel} />
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
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
  },
  send: {
    alignSelf: 'flex-end',
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
}))

export default AudioSend
