import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {Props} from './videoimpl'
import {useState} from './use-state'
import {maxWidth, maxHeight} from '../shared'

// its important we use explicit height/width so we never CLS while loading
const VideoImpl = (p: Props) => {
  const {openFullscreen, allowPlay} = p
  const {previewURL, height, width, url, videoDuration} = useState()
  const [showPoster, setShowPoster] = React.useState(true)
  const [lastUrl, setLastUrl] = React.useState(url)

  if (lastUrl !== url) {
    setLastUrl(url)
    setShowPoster(true)
  }

  const onPress = React.useCallback(() => {
    setShowPoster(false)
  }, [])

  const onDoubleClick = React.useCallback(() => {
    ref.current?.pause()
    openFullscreen()
  }, [openFullscreen])

  const ref = React.useRef<HTMLVideoElement | null>(null)

  return showPoster ? (
    <div onClick={onPress} style={styles.posterContainer}>
      <Kb.Image2 src={previewURL} style={{height, width}} />
      {allowPlay ? <Kb.Icon type="icon-play-64" style={styles.playButton} /> : null}
      <Kb.Box2 direction="vertical" style={styles.durationContainer}>
        <Kb.Text type="BodyTinyBold" style={styles.durationText}>
          {videoDuration}
        </Kb.Text>
      </Kb.Box2>
    </div>
  ) : (
    <video
      ref={ref}
      autoPlay={true}
      onDoubleClick={onDoubleClick}
      height={height}
      width={width}
      poster={previewURL}
      preload="none"
      controls={true}
      playsInline={true}
      controlsList="nodownload noremoteplayback nofullscreen"
      style={Kb.Styles.castStyleDesktop(styles.video)}
    >
      <source src={url} />
    </video>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      downloadIcon: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline-flex',
          opacity: 0.75,
          paddingTop: 2,
        },
      }),
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
      infoIcon: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline-flex',
          opacity: 0.75,
          paddingTop: 2,
        },
      }),
      link: {
        color: Kb.Styles.globalColors.black_50,
        flexGrow: 1,
      },
      playButton: {
        left: '50%',
        marginLeft: -32,
        marginTop: -32,
        position: 'absolute',
        top: '50%',
      },
      posterContainer: {
        display: 'flex',
        flexShrink: 1,
        position: 'relative',
      },
      tipText: {color: Kb.Styles.globalColors.white_75},
      video: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.rounded,
          maxHeight,
          maxWidth,
          objectFit: 'contain',
        },
      }),
    }) as const
)

export default VideoImpl
