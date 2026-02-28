import * as React from 'react'
import * as Styles from '@/styles'
import Box from './box'
import type {Props} from './video'
import {StatusBar} from 'react-native'
import {Video as AVVideo, VideoFullscreenUpdate} from 'expo-av'
import {useCheckURL} from './video.shared'

const Kb = {Box}

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
  const source = React.useMemo(() => {
    if (allowFile) {
      return {uri: Styles.normalizePath(url)}
    }
    return {uri: url}
  }, [url, allowFile])

  const content = (
    <DelayMount>
      <Kb.Box style={styles.container}>
        <AVVideo
          isMuted={muted}
          source={source}
          onError={e => {
            onUrlError?.(JSON.stringify(e))
          }}
          useNativeControls={true}
          shouldPlay={autoPlay ?? true}
          onFullscreenUpdate={event => {
            if (event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_DID_DISMISS) {
              StatusBar.setHidden(false)
            }
          }}
          style={styles.video}
        />
      </Kb.Box>
    </DelayMount>
  )

  return useCheckURL(content, url, allowFile)
}
export default Video

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  video: {
    height: '100%',
    width: '100%',
  },
}))
