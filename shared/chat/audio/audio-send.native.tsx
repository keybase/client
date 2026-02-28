import * as React from 'react'
import * as Kb from '@/common-adapters'
import {PortalHost, Portal} from '@/common-adapters/portal.native'
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
  return <PortalHost name="audioSend" />
}

// This is created and driven by the AudioRecorder button but its ultimately rendered
// through a portal into the parent PlatformInput
const AudioSend = (props: Props) => {
  const {cancelRecording, sendRecording, duration, ampTracker, path} = props

  // render
  const audioUrl = `file://${path}`
  const player = (
    <AudioPlayer
      big={false}
      duration={duration}
      maxWidth={120}
      url={audioUrl}
      visAmps={ampTracker.getBucketedAmps(duration)}
    />
  )
  return (
    <Portal hostName="audioSend" useFullScreenOverlay={false}>
      <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true}>
        <Kb.Box2 direction="horizontal" alignItems="center">
          <Kb.Box style={styles.icon}>
            <Kb.Icon type="iconfont-remove" onClick={cancelRecording} />
          </Kb.Box>
          {player}
        </Kb.Box2>
        <Kb.Button type="Default" small={true} style={styles.send} onClick={sendRecording} label="Send" />
      </Kb.Box2>
    </Portal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    alignItems: 'center',
    borderStyle: 'solid',
    borderTopColor: Kb.Styles.globalColors.black_10,
    borderTopWidth: 1,
    justifyContent: 'space-between',
    paddingLeft: Kb.Styles.globalMargins.tiny,
    paddingRight: Kb.Styles.globalMargins.tiny,
  },
  icon: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    marginRight: Kb.Styles.globalMargins.tiny,
    width: 32,
  },
  send: {
    alignSelf: 'flex-end',
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginTop: Kb.Styles.globalMargins.tiny,
  },
}))

export default AudioSend
