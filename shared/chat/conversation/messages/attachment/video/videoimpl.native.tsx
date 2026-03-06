import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useState} from './use-state'
import {ShowToastAfterSaving} from '../shared'
import {useVideoPlayer, VideoView} from 'expo-video'
import {useEventListener} from 'expo'
import {Pressable} from 'react-native'
import type {Props} from './videoimpl'

const VideoImpl = (p: Props) => {
  const {allowPlay, showPopup} = p
  const {previewURL, height, width, url, transferState, videoDuration} = useState()
  const sourceUri = `${url}&contentforce=true`

  const player = useVideoPlayer(sourceUri, pl => {
    pl.loop = false
  })

  const [showPoster, setShowPoster] = React.useState(true)
  const [lastUrl, setLastUrl] = React.useState(url)

  if (lastUrl !== url) {
    setLastUrl(url)
    setShowPoster(true)
  }

  const onPress = () => {
    setShowPoster(false)
    player.play()
  }

  useEventListener(player, 'playToEnd', () => {
    player.replay()
  })

  return (
    <>
      <ShowToastAfterSaving transferState={transferState} />
      {showPoster ? (
        <Pressable onPress={onPress} style={styles.pressable} onLongPress={showPopup}>
          <Kb.Box2
            direction="vertical"
            style={Kb.Styles.collapseStyles([styles.posterContainer, {height, width}])}
          >
            <Kb.Image src={previewURL} style={Kb.Styles.collapseStyles([styles.poster, {height, width}])} />
            {allowPlay ? <Kb.Icon type="icon-play-64" style={styles.playButton} /> : null}
            <Kb.Box2 direction="vertical" overflow="hidden" style={styles.durationContainer}>
              <Kb.Text type="BodyTinyBold" style={styles.durationText}>
                {videoDuration}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
        </Pressable>
      ) : (
        <VideoView
          player={player}
          nativeControls={true}
          contentFit="cover"
          style={Kb.Styles.collapseStyles([styles.video, {height, width}])}
        />
      )}
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
