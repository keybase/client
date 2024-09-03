import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useState} from './use-state'
import {ShowToastAfterSaving} from '../shared'
import {Video, ResizeMode, type AVPlaybackStatus} from 'expo-av'
import {Pressable} from 'react-native'
import type {Props} from './videoimpl'

const VideoImpl = (p: Props) => {
  const {allowPlay, showPopup} = p
  const {previewURL, height, width, url, transferState, videoDuration} = useState()
  const source = React.useMemo(() => ({uri: `${url}&contentforce=true`}), [url])

  const ref = React.useRef<Video | null>(null)
  const [showPoster, setShowPoster] = React.useState(true)
  const [lastUrl, setLastUrl] = React.useState(url)

  if (lastUrl !== url) {
    setLastUrl(url)
    setShowPoster(true)
  }

  const onPress = React.useCallback(() => {
    setShowPoster(false)
  }, [])

  const onPlaybackStatusUpdate = React.useCallback((status: AVPlaybackStatus) => {
    const f = async () => {
      if (!status.isLoaded) {
        return
      }

      if (status.didJustFinish) {
        await ref.current?.setPositionAsync(0)
      }
    }
    C.ignorePromise(f())
  }, [])

  return (
    <>
      <ShowToastAfterSaving transferState={transferState} />
      <Pressable onPress={onPress} style={styles.pressable} onLongPress={showPopup}>
        {showPoster ? (
          <Kb.Box2
            direction="vertical"
            style={Kb.Styles.collapseStyles([styles.posterContainer, {height, width}])}
          >
            <Kb.Image2 src={previewURL} style={Kb.Styles.collapseStyles([styles.poster, {height, width}])} />
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
            style={Kb.Styles.collapseStyles([styles.video, {height, width}])}
            resizeMode={ResizeMode.COVER}
          />
        )}
      </Pressable>
    </>
  )
}
const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      durationContainer: {
        alignSelf: 'flex-end',
        backgroundColor: Kb.Styles.globalColors.black_50,
        borderRadius: 2,
        bottom: Kb.Styles.globalMargins.tiny,
        overflow: 'hidden',
        padding: 1,
        position: 'absolute',
        right: Kb.Styles.globalMargins.tiny,
      },
      durationText: {
        color: Kb.Styles.globalColors.white,
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
        backgroundColor: Kb.Styles.globalColors.black_05_on_white,
        opacity: 1,
      },
      posterContainer: {
        position: 'relative',
      },
      pressable: {
        position: 'relative',
        width: '100%',
      },
      video: {
        alignSelf: 'center',
      },
    }) as const
)

export default VideoImpl
