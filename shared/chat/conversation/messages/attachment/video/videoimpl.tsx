import * as Kb from '@/common-adapters'
import * as React from 'react'
import type {Props} from './videoimpl.shared'
import {usePosterState, sharedStyles} from './videoimpl.shared'
import {getAttachmentPreviewSize, ShowToastAfterSaving, maxHeight, maxWidth} from '../shared'
import {useVideoPlayer, VideoView} from 'expo-video'
import {useEventListener} from 'expo'
import {Pressable} from 'react-native'

// Stub type to avoid dom lib dependency in native tsconfig
type VideoElementRef = {
  pause: () => void
}

const DesktopVideoImpl = (p: Props) => {
  const {allowPlay, message, openFullscreen} = p
  const {fileURL: url, videoDuration} = message
  const {previewURL, height, width} = getAttachmentPreviewSize(message)
  const {showPoster, reveal} = usePosterState(url)
  const ref = React.useRef<VideoElementRef | null>(null)

  const onDoubleClick = () => {
    ref.current?.pause()
    openFullscreen?.()
  }

  return showPoster ? (
    <div onClick={reveal} style={desktopStyles.posterContainer}>
      <Kb.Image src={previewURL} style={{height, width}} />
      {allowPlay ? <Kb.ImageIcon type="icon-play-64" style={sharedStyles.playButton} /> : null}
      <Kb.Box2 direction="vertical" overflow="hidden" style={sharedStyles.durationContainer}>
        <Kb.Text type="BodyTinyBold" style={sharedStyles.durationText}>
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

// Separated into its own component so useVideoPlayer is only called when the
// user actually taps play. Calling useVideoPlayer unconditionally for every
// video message in the list caused CoreMedia to initialize a player per
// message, spawning dozens of network threads and exhausting VM memory.
type NativeActiveVideoProps = {
  sourceUri: string
  height: number
  width: number
}

const NativeActiveVideo = (p: NativeActiveVideoProps) => {
  const {sourceUri, height, width} = p
  const player = useVideoPlayer(sourceUri, pl => {
    pl.loop = false
    pl.play()
  })
  useEventListener(player, 'playToEnd', () => {
    player.replay()
  })
  return (
    <VideoView
      player={player}
      nativeControls={true}
      contentFit="cover"
      style={(Kb.Styles.collapseStyles([nativeStyles.video, {height, width}]) ?? {}) as object}
    />
  )
}

const NativeVideoImpl = (p: Props) => {
  const {allowPlay, message, showPopup} = p
  const {fileURL: url, transferState, videoDuration} = message
  const {previewURL, height, width} = getAttachmentPreviewSize(message)
  const [playerActive, setPlayerActive] = React.useState(false)
  const [lastUrl, setLastUrl] = React.useState(url)
  if (lastUrl !== url) {
    setLastUrl(url)
    setPlayerActive(false)
  }
  const sourceUri = `${url}&contentforce=true`

  return (
    <>
      <ShowToastAfterSaving transferState={transferState} />
      {playerActive && url ? (
        <NativeActiveVideo sourceUri={sourceUri} height={height} width={width} />
      ) : (
        <Pressable
          onPress={() => {
            if (allowPlay) setPlayerActive(true)
          }}
          style={nativeStyles.pressable}
          onLongPress={showPopup}
        >
          <Kb.Box2
            direction="vertical"
            style={Kb.Styles.collapseStyles([nativeStyles.posterContainer, {height, width}])}
          >
            <Kb.Image src={previewURL} style={Kb.Styles.collapseStyles([nativeStyles.poster, {height, width}])} />
            {allowPlay ? <Kb.ImageIcon type="icon-play-64" style={sharedStyles.playButton} /> : null}
            <Kb.Box2 direction="vertical" overflow="hidden" style={sharedStyles.durationContainer}>
              <Kb.Text type="BodyTinyBold" style={sharedStyles.durationText}>
                {videoDuration}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
        </Pressable>
      )}
    </>
  )
}

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
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
