import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import * as React from 'react'
import type * as T from '@/constants/types'
import {getAttachmentPreviewSize, ShowToastAfterSaving, maxHeight, maxWidth} from '../shared'

type Props = {
  openFullscreen?: () => void
  showPopup?: () => void
  allowPlay: boolean
  message: T.Chat.MessageAttachment
}

const usePosterState = (url: string) => {
  const [showPoster, setShowPoster] = React.useState(true)
  const [lastUrl, setLastUrl] = React.useState(url)
  if (lastUrl !== url) {
    setLastUrl(url)
    setShowPoster(true)
  }
  return {reveal: () => setShowPoster(false), showPoster}
}

// The video's own surface belongs to its player controls (a tap shows the controls on iOS), so
// fullscreen is this button in the corner the player leaves free. Desktop uses the player's own.
const FullscreenButton = ({onClick}: {onClick: () => void}) => {
  const sharedStyles = useSharedStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Box2 direction="vertical" style={sharedStyles.fullscreenButton}>
      <Kb.Icon
        type="iconfont-app-maximize"
        color={theme.white}
        padding="xtiny"
        hint="Open fullscreen"
        onClick={onClick}
        testID={TestIDs.CHAT_VIDEO_FULLSCREEN}
      />
    </Kb.Box2>
  )
}

const useSharedStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      durationContainer: {
        alignSelf: 'flex-end',
        backgroundColor: theme.black_50,
        borderRadius: 2,
        bottom: Kb.Styles.globalMargins.tiny,
        padding: 1,
        position: 'absolute',
        right: Kb.Styles.globalMargins.tiny,
      },
      durationText: {
        color: theme.white,
        paddingLeft: 3,
        paddingRight: 3,
      },
      fullscreenButton: {
        backgroundColor: theme.black_50,
        borderRadius: 2,
        left: Kb.Styles.globalMargins.tiny,
        position: 'absolute',
        top: Kb.Styles.globalMargins.tiny,
      },
      playButton: {
        left: '50%',
        marginLeft: -32,
        marginTop: -32,
        position: 'absolute',
        top: '50%',
      },
    }) as const
)
import {useVideoPlayer, VideoView} from 'expo-video'
import {Pressable} from 'react-native'

const DesktopVideoImpl = (p: Props) => {
  const desktopStyles = useDesktopStyles()
  const sharedStyles = useSharedStyles()
  const {allowPlay, message} = p
  const {fileURL: url, videoDuration} = message
  const {previewURL, height, width} = getAttachmentPreviewSize(message)
  const {reveal, showPoster} = usePosterState(url)

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
    <Kb.Box2 direction="vertical">
      <video
        autoPlay={true}
        height={height}
        width={width}
        poster={previewURL}
        preload="none"
        controls={true}
        playsInline={true}
        controlsList="nodownload noremoteplayback"
        style={Kb.Styles.castStyleDesktop(desktopStyles.video)}
      >
        <source src={url} />
      </video>
    </Kb.Box2>
  )
}

// Separated into its own component so useVideoPlayer is only called when the
// user actually taps play. Calling useVideoPlayer unconditionally for every
// video message in the list caused CoreMedia to initialize a player per
// message, spawning dozens of network threads and exhausting VM memory.
type NativeActiveVideoProps = {
  fullscreenButton: React.ReactNode
  sourceUri: string
  height: number
  width: number
}

const NativeActiveVideo = (p: NativeActiveVideoProps) => {
  const nativeStyles = useNativeStyles()
  const {fullscreenButton, sourceUri, height, width} = p
  const player = useVideoPlayer(sourceUri, pl => {
    // a player released while its screen was frozen throws from every call
    try {
      pl.loop = false
      pl.play()
    } catch {}
  })
  // the player's own fullscreen is off: fullscreen is the app's attachment view
  return (
    <Kb.Box2 direction="vertical" relative={true} style={nativeStyles.video}>
      <VideoView
        player={player}
        nativeControls={true}
        fullscreenOptions={nativeFullscreenOptions}
        contentFit="cover"
        style={{height, width}}
      />
      {fullscreenButton}
    </Kb.Box2>
  )
}

const nativeFullscreenOptions = {enable: false}

const NativeVideoImpl = (p: Props) => {
  const nativeStyles = useNativeStyles()
  const sharedStyles = useSharedStyles()
  const {allowPlay, message, openFullscreen, showPopup} = p
  const {fileURL: url, transferState, videoDuration} = message
  const {previewURL, height, width} = getAttachmentPreviewSize(message)
  const [playerActive, setPlayerActive] = React.useState(false)
  const [lastUrl, setLastUrl] = React.useState(url)
  if (lastUrl !== url) {
    setLastUrl(url)
    setPlayerActive(false)
  }
  const sourceUri = `${url}&contentforce=true`
  // the fullscreen view plays it, so the inline one goes back to its poster
  const fullscreenButton = openFullscreen ? (
    <FullscreenButton
      onClick={() => {
        setPlayerActive(false)
        openFullscreen()
      }}
    />
  ) : null

  return (
    <>
      <ShowToastAfterSaving transferState={transferState} />
      {playerActive && url ? (
        <NativeActiveVideo
          fullscreenButton={fullscreenButton}
          sourceUri={sourceUri}
          height={height}
          width={width}
        />
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
            {fullscreenButton}
          </Kb.Box2>
        </Pressable>
      )}
    </>
  )
}

const useDesktopStyles = Kb.Styles.createStyleHook(
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

const useNativeStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      poster: {
        backgroundColor: theme.black_05_on_white,
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
