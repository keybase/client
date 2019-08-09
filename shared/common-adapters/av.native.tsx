import * as React from 'react'
import {Props} from './av'
import Box from './box'
import * as Styles from '../styles'
import {useVideoSizer, CheckURL} from './av.shared'
import {Video as ExpoVideo} from 'expo-av'
import {StatusBar} from 'react-native'
import logger from '../logger'

const Kb = {
  Box,
}

export const Video = (props: Props) => {
  const [videoSize, setContainerSize, setVideoNaturalSize] = useVideoSizer()
  return (
    <CheckURL url={props.url}>
      <Kb.Box
        style={styles.container}
        onLayout={event =>
          event &&
          event.nativeEvent &&
          event.nativeEvent.layout &&
          setContainerSize(event.nativeEvent.layout.height, event.nativeEvent.layout.width)
        }
      >
        <ExpoVideo
          source={{uri: props.url}}
          onError={e => {
            logger.error(`Error loading vid: ${JSON.stringify(e)}`)
          }}
          useNativeControls={!!props.controls}
          onFullscreenUpdate={update =>
            update.fullscreenUpdate === ExpoVideo.FULLSCREEN_UPDATE_PLAYER_WILL_DISMISS &&
            StatusBar.setHidden(false)
          }
          onReadyForDisplay={ready =>
            ready &&
            ready.naturalSize &&
            setVideoNaturalSize(ready.naturalSize.height, ready.naturalSize.width)
          }
          style={videoSize}
          isMuted={!!props.muted}
          resizeMode={ExpoVideo.RESIZE_MODE_CONTAIN}
          shouldPlay={!!props.autoPlay}
          isLooping={!!props.loop}
        />
      </Kb.Box>
    </CheckURL>
  )
}

// TODO we should probalby have custom style here. The controls auto hides on
// Android.
export const Audio = (props: Props) => (
  <ExpoVideo
    source={{uri: props.url}}
    onError={e => {
      logger.error(`Error loading vid: ${JSON.stringify(e)}`)
    }}
    useNativeControls={!!props.controls}
    isMuted={!!props.muted}
    shouldPlay={!!props.autoPlay}
    isLooping={!!props.loop}
    style={styles.audio}
  />
)

const styles = Styles.styleSheetCreate({
  audio: {
    ...Styles.globalStyles.fullWidth,
    backgroundColor: Styles.globalColors.black,
    height: Styles.isAndroid ? 96 : 48,
  },
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
})
