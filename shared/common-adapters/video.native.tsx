import * as React from 'react'
import {Props} from './video'
import Box, {Box2} from './box'
import * as Styles from '../styles'
import {useVideoSizer, CheckURL} from './video.shared'
import {NativeStatusBar, NativeWebView} from './native-wrappers.native'
import RNVideo from 'react-native-video'
import {StatusBar} from 'react-native'
import logger from '../logger'

const Kb = {
  Box,
  Box2,
  NativeStatusBar,
  NativeWebView,
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
  // Somehow onFullscreenPlayerDidDismiss doesn't trigger, and RNVideo doesn't
  // automatically bring back the status bar either. As a workaround, call it
  // on unmount so at least we get the status bar back when user leaves the
  // screen.
  React.useEffect(() => () => StatusBar.setHidden(false), [])
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
              logger.error(`Error loading vid: ${JSON.stringify(e)}`)
            }}
            muted={true}
            controls={true}
            onFullscreenPlayerWillPresent={() => console.log({songgao: 'onFullscreenPlayerWillPresent'})}
            onFullscreenPlayerDidDismiss={() => {
              console.log({songgao: 'onFullscreenPlayerDidDismiss'})
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

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
})
