import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import {useRedux} from './use-redux'
import {ShowToastAfterSaving} from '../shared'
import {Video, ResizeMode, type AVPlaybackStatus} from 'expo-av'
import {Pressable} from 'react-native'
import type {Props} from './videoimpl'

const VideoImpl = (p: Props) => {
  const {allowPlay, toggleMessageMenu} = p
  const {previewURL, height, width, url, transferState, videoDuration} = useRedux()
  const source = React.useMemo(() => ({uri: `${url}&contentforce=true`}), [url])

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

  const fiSrc = React.useMemo(() => ({uri: previewURL}), [previewURL])

  return (
    <>
      <ShowToastAfterSaving transferState={transferState} />
      <Pressable onPress={onPress} style={styles.pressable} onLongPress={toggleMessageMenu}>
        {showPoster ? (
          <Kb.Box2
            direction="vertical"
            style={Styles.collapseStyles([styles.posterContainer, {height, width}])}
          >
            <Kb.NativeFastImage
              source={fiSrc}
              style={Styles.collapseStyles([styles.poster, {height, width}])}
            />
            {allowPlay ? <Kb.Icon type="icon-play-64" style={styles.playButton} /> : null}
            <Kb.Box2 direction="vertical" style={styles.durationContainer}>
              <Kb.Text type="BodyTinyBold" style={styles.durationText}>
                {videoDuration}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
        ) : (
          <Video
            ref={ref}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            source={source}
            useNativeControls={true}
            shouldPlay={true}
            usePoster={false}
            style={Styles.collapseStyles([styles.video, {height, width}])}
            resizeMode={ResizeMode.COVER}
          />
        )}
      </Pressable>
    </>
  )
}
const styles = Styles.styleSheetCreate(
  () =>
    ({
      durationContainer: {
        alignSelf: 'flex-end',
        backgroundColor: Styles.globalColors.black_50,
        borderRadius: 2,
        bottom: Styles.globalMargins.tiny,
        overflow: 'hidden',
        padding: 1,
        position: 'absolute',
        right: Styles.globalMargins.tiny,
      },
      durationText: {
        color: Styles.globalColors.white,
        paddingLeft: 3,
        paddingRight: 3,
      },
      playButton: {
        left: '50%',
        marginLeft: -32,
        marginTop: -32,
        position: 'absolute',
        top: '50%',
      },
      poster: {
        backgroundColor: Styles.globalColors.black_05_on_white,
        opacity: 0,
      },
      posterContainer: {
        position: 'relative',
      },
      pressable: {
        position: 'relative',
        width: '100%',
      },
      video: {},
    } as const)
)

export default VideoImpl
