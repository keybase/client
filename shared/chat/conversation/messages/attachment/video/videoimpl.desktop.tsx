import * as Kb from '../../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../../styles'
import type {Props} from './videoimpl'
import {useRedux} from './use-redux'

// its important we use explicit height/width so we never CLS while loading
const VideoImpl = (p: Props) => {
  const {openFullscreen, allowPlay} = p
  const {previewURL, height, width, url, videoDuration} = useRedux()
  const [showPoster, setShowPoster] = React.useState(true)

  React.useEffect(() => {
    setShowPoster(true)
  }, [url])

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
      <Kb.Image src={previewURL} style={{height, width}} />
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
      controlsList="nodownload nofullscreen noremoteplayback"
      style={styles.video as any}
    >
      <source src={url} />
    </video>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      downloadIcon: Styles.platformStyles({
        isElectron: {
          display: 'inline-flex',
          opacity: 0.75,
          paddingTop: 2,
        },
      }),
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
      infoIcon: Styles.platformStyles({
        isElectron: {
          display: 'inline-flex',
          opacity: 0.75,
          paddingTop: 2,
        },
      }),
      link: {
        color: Styles.globalColors.black_50,
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
      tipText: {color: Styles.globalColors.white_75},
      video: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.rounded,
          maxHeight: 320,
          maxWidth: 320,
          objectFit: 'contain',
        },
      }),
    } as const)
)

export default VideoImpl
