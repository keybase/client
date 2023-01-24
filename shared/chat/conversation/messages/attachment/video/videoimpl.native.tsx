import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {useRedux} from './use-redux'
import {ShowToastAfterSaving} from '../shared'
import {Video, ResizeMode, type AVPlaybackStatus} from 'expo-av'
import {Pressable} from 'react-native'
import type {Props} from './videoimpl'

const VideoImpl = (_p: Props) => {
  const {previewURL, height, width, url, transferState, videoDuration} = useRedux()
  const source = React.useMemo(() => ({uri: `${url}&contentforce=true`}), [url])

  const posterSource = React.useMemo(() => ({uri: previewURL}), [previewURL])
  const ref = React.useRef<Video | null>(null)

  const [showPoster, setShowPoster] = React.useState(true)

  React.useEffect(() => {
    setShowPoster(true)
  }, [url])

  const onPress = React.useCallback(() => {
    setShowPoster(false)
  }, [])

  const onPlaybackStatusUpdate = React.useCallback(async (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return
    }

    if (status.didJustFinish) {
      await ref.current?.setPositionAsync(0)
    }
  }, [])

  return (
    <>
      <ShowToastAfterSaving transferState={transferState} />
      <Pressable onPress={onPress} style={styles.pressable}>
        <Video
          ref={ref}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          source={source}
          useNativeControls={true}
          shouldPlay={!showPoster}
          usePoster={showPoster}
          posterSource={posterSource}
          posterStyle={styles.poster}
          style={Styles.collapseStyles([styles.video, {height, width}])}
          resizeMode={ResizeMode.CONTAIN}
        />
        {showPoster ? <Kb.Icon type="icon-play-64" style={styles.playButton} /> : null}
      </Pressable>
      <Kb.Text type="BodyTinyBold" style={styles.duration}>
        {videoDuration}
      </Kb.Text>
    </>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      duration: {alignSelf: 'flex-end'},
      playButton: {
        ...Styles.globalStyles.fillAbsolute,
        bottom: '50%',
        left: '50%',
        marginBottom: -32,
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        right: '50%',
        top: '50%',
      },
      poster: {backgroundColor: Styles.globalColors.black_05_on_white},
      pressable: {position: 'relative'},
      video: {
        maxHeight: 320,
        maxWidth: '100%',
      },
    } as const)
)

export default VideoImpl
