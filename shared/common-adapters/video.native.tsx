import * as React from 'react'
import {Props} from './video'
import Box from './box'
import * as Styles from '../styles'
import {useVideoSizer, CheckURL} from './video.shared'
import RNVideo from 'react-native-video'
import {StatusBar} from 'react-native'
import useFixStatusbar from './use-fix-statusbar.native'

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
    <CheckURL url={props.url}>
      <DelayMount>
        <Kb.Box
          style={styles.container}
          onLayout={event =>
            event &&
            event.nativeEvent &&
            event.nativeEvent.layout &&
            setContainerSize(event.nativeEvent.layout.height, event.nativeEvent.layout.width)
          }
        >
          <RNVideo
            source={{uri: props.url}}
            onError={e => {
              props.onUrlError && props.onUrlError(JSON.stringify(e))
            }}
            controls={true}
            onFullscreenPlayerDidDismiss={() => {
              StatusBar.setHidden(false)
            }}
            onLoad={loaded =>
              loaded &&
              loaded.naturalSize &&
              setVideoNaturalSize(loaded.naturalSize.height, loaded.naturalSize.width)
            }
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
