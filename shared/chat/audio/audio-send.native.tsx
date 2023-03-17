import * as React from 'react'
import * as Kb from '../../common-adapters/mobile.native'
import * as Styles from '../../styles'
import AudioPlayer from './audio-player'
import type {AmpTracker} from './amptracker'

type Props = {
  cancelRecording: () => void
  sendRecording: () => void
  duration: number
  ampTracker: AmpTracker
  path: string
}

export const ShowAudioSendContext = React.createContext({
  setShowAudioSend: (_s: boolean) => {},
  showAudioSend: false,
})

export const AudioSendWrapper = () => {
  return <Kb.PortalHost name="audioSend" />
}

// This is created and driven by the AudioRecorder button but its ultimately rendered
// through a portal into the parent PlatformInput
const AudioSend = (props: Props) => {
  const {cancelRecording, sendRecording, duration, ampTracker, path} = props

  // render
  let player = <Kb.Text type="Body">No recording available</Kb.Text>
  const audioUrl = `file://${path}`
  player = (
    <AudioPlayer
      big={false}
      duration={duration}
      maxWidth={120}
      url={audioUrl}
      visAmps={ampTracker.getBucketedAmps(duration)}
    />
  )
  return (
    <Kb.Portal hostName="audioSend" useFullScreenOverlay={false}>
      <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true}>
        <Kb.Box2 direction="horizontal" alignItems="center">
          <Kb.Box style={styles.icon}>
            <Kb.Icon type="iconfont-remove" onClick={cancelRecording} />
          </Kb.Box>
          {player}
        </Kb.Box2>
        <Kb.Button type="Default" small={true} style={styles.send} onClick={sendRecording} label="Send" />
      </Kb.Box2>
    </Kb.Portal>
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
  icon: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    marginRight: Styles.globalMargins.tiny,
    width: 32,
  },
  send: {
    alignSelf: 'flex-end',
    marginBottom: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
}))

export default AudioSend
