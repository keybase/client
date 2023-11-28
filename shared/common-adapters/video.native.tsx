import * as React from 'react'
import * as Styles from '@/styles'
import Box from './box'
import type {Props} from './video'
import {StatusBar} from 'react-native'
import {Video as AVVideo, VideoFullscreenUpdate} from 'expo-av'
import {useVideoSizer, CheckURL} from './video.shared'

const Kb = {Box}

// There seems to be a race between navigation animation and the measurement stuff
// here that causes stuff to be rendered off-screen. So delay mounting to avoid
// the race.
const DelayMount = ({children}: {children: React.ReactNode}) => {
  const [mount, setMount] = React.useState(false)
  React.useEffect(() => {
    const id = setTimeout(() => setMount(true), 500)
    return () => clearTimeout(id)
  }, [])
  return mount && children
}

const Video = (props: Props) => {
  const {url, allowFile} = props
  const [videoSize, setContainerSize, setVideoNaturalSize] = useVideoSizer()
  const source = React.useMemo(() => {
    if (allowFile) {
      return {uri: Styles.normalizePath(url)}
    }
    return {uri: url}
  }, [url, allowFile])

  return (
    <CheckURL url={props.url} allowFile={props.allowFile}>
      <DelayMount>
        <Kb.Box
          style={styles.container}
          onLayout={event => {
            setContainerSize(event.nativeEvent.layout.height, event.nativeEvent.layout.width)
          }}
        >
          <AVVideo
            isMuted={props.muted}
            source={source}
            onError={e => {
              props.onUrlError && props.onUrlError(JSON.stringify(e))
            }}
            useNativeControls={true}
            shouldPlay={props.autoPlay ?? true}
            onFullscreenUpdate={event => {
              if (event.fullscreenUpdate === VideoFullscreenUpdate.PLAYER_DID_DISMISS) {
                StatusBar.setHidden(false)
              }
            }}
            onReadyForDisplay={event => {
              setVideoNaturalSize(event.naturalSize.height, event.naturalSize.width)
            }}
            style={videoSize}
          />
        </Kb.Box>
      </DelayMount>
    </CheckURL>
  )
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
}))
