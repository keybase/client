import * as React from 'react'
import * as Styles from '../styles'
import Box from './box'
import type {Props} from './video'
import useFixStatusbar from './use-fix-statusbar.native'
import {StatusBar} from 'react-native'
import {Video as AVVideo, VideoFullscreenUpdate} from 'expo-av'
import {useVideoSizer, CheckURL} from './video.shared'

const Kb = {
  Box,
}

// There seems to be a race between navigation animation and the measurement stuff
// here that causes stuff to be rendered off-screen. So delay mounting to avoid
// the race.
const DelayMount = ({children}) => {
  const [mount, setMount] = React.useState(false)
  React.useEffect(() => {
    const id = setTimeout(() => setMount(true), 500)
    return () => clearTimeout(id)
  }, [])
  return mount && children
}

const Video = (props: Props) => {
  const [videoSize, setContainerSize, setVideoNaturalSize] = useVideoSizer()
  useFixStatusbar()
  return (
    <CheckURL url={props.url} allowFile={props.allowFile}>
      <DelayMount>
        <Kb.Box
          style={styles.container}
          onLayout={event => {
            event?.nativeEvent?.layout &&
              setContainerSize(event.nativeEvent.layout.height, event.nativeEvent.layout.width)
          }}
        >
          <AVVideo
            isMuted={props.muted}
            source={{uri: props.url}}
            onError={e => {
              props.onUrlError && props.onUrlError(JSON.stringify(e))
            }}
            useNativeControls={true}
            shouldPlay={true}
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
