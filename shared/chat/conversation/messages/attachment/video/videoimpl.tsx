import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {Props} from './videoimpl.shared'
import {getAttachmentPreviewSize, ShowToastAfterSaving, maxHeight, maxWidth} from '../shared'

// Stub type to avoid dom lib dependency in native tsconfig
type VideoElementRef = {
  pause: () => void
}

const DesktopVideoImpl = (p: Props) => {
  const {allowPlay, message, openFullscreen} = p
  const {fileURL: url, videoDuration} = message
  const {previewURL, height, width} = getAttachmentPreviewSize(message)
  const [showPoster, setShowPoster] = React.useState(true)
  const [lastUrl, setLastUrl] = React.useState(url)

  if (lastUrl !== url) {
    setLastUrl(url)
    setShowPoster(true)
  }

  const onPress = () => {
    setShowPoster(false)
  }

  const onDoubleClick = () => {
    ref.current?.pause()
    openFullscreen?.()
  }

  const ref = React.useRef<VideoElementRef | null>(null)

  return showPoster ? (
    <div onClick={onPress} style={desktopStyles.posterContainer}>
      <Kb.Image src={previewURL} style={{height, width}} />
      {allowPlay ? <Kb.ImageIcon type="icon-play-64" style={desktopStyles.playButton} /> : null}
      <Kb.Box2 direction="vertical" overflow="hidden" style={desktopStyles.durationContainer}>
        <Kb.Text type="BodyTinyBold" style={desktopStyles.durationText}>
          {videoDuration}
        </Kb.Text>
      </Kb.Box2>
    </div>
  ) : (
    <video
      ref={ref as React.RefObject<HTMLVideoElement>}
      autoPlay={true}
      onDoubleClick={openFullscreen ? onDoubleClick : undefined}
      height={height}
      width={width}
      poster={previewURL}
      preload="none"
      controls={true}
      playsInline={true}
      controlsList="nodownload noremoteplayback nofullscreen"
      style={Kb.Styles.castStyleDesktop(desktopStyles.video)}
    >
      <source src={url} />
    </video>
  )
}

const NativeVideoImpl = (p: Props) => {
  const {useVideoPlayer, VideoView} = require('expo-video') as {
    useVideoPlayer: (uri: string, cb: (pl: {loop: boolean}) => void) => {
      play: () => void
      replay: () => void
    }
    VideoView: React.ComponentType<{
      player: ReturnType<typeof useVideoPlayer>
      nativeControls: boolean
      contentFit: string
      style: object
    }>
  }
  const {useEventListener} = require('expo') as {useEventListener: (player: unknown, event: string, cb: () => void) => void}
  const {Pressable} = require('react-native') as {Pressable: React.ComponentType<{
    onPress: () => void
    style: object
    onLongPress?: () => void
    children?: React.ReactNode
  }>}

  const {allowPlay, message, showPopup} = p
  const {fileURL: url, transferState, videoDuration} = message
  const {previewURL, height, width} = getAttachmentPreviewSize(message)
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
        <Pressable onPress={onPress} style={nativeStyles.pressable} onLongPress={showPopup}>
          <Kb.Box2
            direction="vertical"
            style={Kb.Styles.collapseStyles([nativeStyles.posterContainer, {height, width}])}
          >
            <Kb.Image src={previewURL} style={Kb.Styles.collapseStyles([nativeStyles.poster, {height, width}])} />
            {allowPlay ? <Kb.ImageIcon type="icon-play-64" style={nativeStyles.playButton} /> : null}
            <Kb.Box2 direction="vertical" overflow="hidden" style={nativeStyles.durationContainer}>
              <Kb.Text type="BodyTinyBold" style={nativeStyles.durationText}>
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
          style={(Kb.Styles.collapseStyles([nativeStyles.video, {height, width}]) ?? {}) as object}
        />
      )}
    </>
  )
}

const desktopStyles = Kb.Styles.styleSheetCreate(
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
      posterContainer: {
        display: 'flex',
        flexShrink: 1,
        position: 'relative',
      },
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

const nativeStyles = Kb.Styles.styleSheetCreate(
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

export default isMobile ? NativeVideoImpl : DesktopVideoImpl
