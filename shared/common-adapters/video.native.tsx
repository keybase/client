import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import type {Props} from './video'
import {StatusBar} from 'react-native'
import {useVideoPlayer, VideoView} from 'expo-video'
import {useEventListener} from 'expo'
import {useCheckURL} from './video.shared'

const Kb = {Box2}

// There seems to be a race between navigation animation and the measurement stuff
// here that causes stuff to be rendered off-screen. So delay mounting to avoid
// the race.
const DelayMount = ({children}: {children: React.ReactNode}): React.ReactNode => {
  const [mount, setMount] = React.useState(false)
  React.useEffect(() => {
    const id = setTimeout(() => setMount(true), 500)
    return () => clearTimeout(id)
  }, [])
  return mount && children
}

const Video = (props: Props) => {
  const {url: _url, allowFile, muted, onUrlError, autoPlay} = props
  const url = Styles.urlEscapeFilePath(_url)
  const uri = allowFile ? Styles.normalizePath(url) : url

  const player = useVideoPlayer(uri, p => {
    p.muted = muted ?? false
    if (autoPlay ?? true) {
      p.play()
    }
  })

  useEventListener(player, 'statusChange', ({status, error}) => {
    if (status === 'error' && error && onUrlError) {
      onUrlError(JSON.stringify(error))
    }
  })

  const content = (
    <DelayMount>
      <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.container}>
        <VideoView
          player={player}
          nativeControls={true}
          contentFit="contain"
          onFullscreenExit={() => {
            StatusBar.setHidden(false)
          }}
          style={styles.video}
        />
      </Kb.Box2>
    </DelayMount>
  )

  return useCheckURL(content, url, allowFile)
}
export default Video

const styles = Styles.styleSheetCreate(() => ({
  container: {
    height: '100%',
    width: '100%',
  },
  video: {
    height: '100%',
    width: '100%',
  },
}))
