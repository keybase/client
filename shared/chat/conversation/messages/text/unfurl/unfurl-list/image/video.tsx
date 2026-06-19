import * as Kb from '@/common-adapters/index'
import * as React from 'react'
import logger from '@/logger'

type Props = {
  autoPlay: boolean
  height: number
  style: object
  onClick?: () => void
  url: string
  width: number
}

const usePlayState = (url: string, autoPlay: boolean) => {
  const [playing, setPlaying] = React.useState(autoPlay)
  const [lastAutoPlay, setLastAutoPlay] = React.useState(autoPlay)
  const [lastUrl, setLastUrl] = React.useState(url)
  if (lastAutoPlay !== autoPlay || lastUrl !== url) {
    setLastAutoPlay(autoPlay)
    setLastUrl(url)
    setPlaying(autoPlay)
  }
  return {playing, setPlaying}
}

const sharedStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      absoluteContainer: {
        left: 0,
        position: 'absolute',
        top: 0,
      },
      playButton: {
        bottom: '50%',
        left: '50%',
        margin: -32,
        position: 'absolute',
        right: '50%',
        top: '50%',
      },
    }) as const
)
import {useVideoPlayer, VideoView} from 'expo-video'
import {useIsFocused} from '@react-navigation/core'

// Stub type to avoid dom lib dependency in native tsconfig
type VideoElementRef = {
  play: () => Promise<void>
  pause: () => void
}

const DesktopVideo = (p: Props) => {
  const {autoPlay, onClick, height, width, style, url} = p
  const videoRef = React.useRef<VideoElementRef | null>(null)
  const {playing, setPlaying} = usePlayState(url, autoPlay)

  const _onClick = () => {
    if (onClick) {
      onClick()
      return
    }
    if (!videoRef.current) {
      return
    }
    if (!playing) {
      videoRef.current
        .play()
        .then(() => {})
        .catch(() => {})
    } else {
      videoRef.current.pause()
    }
    setPlaying(p => !p)
  }

  return (
    <Kb.Box2 direction="horizontal" relative={true} alignSelf="flex-start">
      <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([sharedStyles.absoluteContainer, {height, width}])}>
        {!playing && <Kb.ImageIcon type="icon-play-64" style={sharedStyles.playButton} />}
      </Kb.Box2>
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        onClick={_onClick}
        autoPlay={autoPlay}
        muted={true}
        src={url}
        style={style}
        loop={true}
      />
    </Kb.Box2>
  )
}

// Separated into its own component so useVideoPlayer is only called when the
// player is needed. Calling it unconditionally for every unfurl in the list
// spawns CoreMedia threads per message and exhausts VM memory.
type NativeActiveVideoProps = {
  sourceUri: string
  autoPlay: boolean
  playing: boolean
  style: object
}

const NativeActiveVideo = (props: NativeActiveVideoProps) => {
  const {sourceUri, autoPlay, playing, style} = props

  const player = useVideoPlayer(sourceUri, p => {
    try {
      p.loop = true
      p.muted = true
      // Don't interrupt the user's background audio (e.g. music). Default
      // 'auto' grabs an exclusive iOS audio session and pauses other apps,
      // even though this player is muted.
      p.audioMixingMode = 'mixWithOthers'
      if (autoPlay) {
        p.play()
      }
    } catch {
      // player's native shared object may be released; ignore
    }
  })

  React.useEffect(() => {
    // When a frozen screen (react-native-screens Freeze/Activity) reconnects
    // its passive effects, the native player may already be released. Calling
    // play/pause then throws NativeSharedObjectNotFoundException synchronously.
    try {
      if (playing) {
        player.play()
      } else {
        player.pause()
      }
    } catch {}
  }, [player, playing])

  React.useEffect(() => {
    try {
      const sub = player.addListener('statusChange', ({status, error}) => {
        if (status === 'error' && error) {
          logger.error(`Error loading vid: ${JSON.stringify(error)}`)
        }
      })
      return () => {
        try {
          sub.remove()
        } catch {}
      }
    } catch {
      return () => {}
    }
  }, [player])

  return (
    <VideoView
      player={player}
      nativeControls={false}
      contentFit="contain"
      style={(Kb.Styles.collapseStyles([nativeStyles.player, style]) ?? {}) as object}
    />
  )
}

const NativeVideo = (props: Props) => {
  const {autoPlay, onClick, url, style, width, height} = props
  const {playing, setPlaying} = usePlayState(url, autoPlay)
  // Activate the player when autoPlay is true or the user first taps play.
  // Reset when URL changes so a new source gets a fresh player.
  const [active, setActive] = React.useState(autoPlay)
  const [lastUrl, setLastUrl] = React.useState(url)
  if (lastUrl !== url) {
    setLastUrl(url)
    setActive(autoPlay)
  }

  // When the screen blurs (e.g. a modal opens over the conversation),
  // react-native-screens freezes it and expo-video releases the native
  // player, leaving a blank view on return. Remount the player on refocus.
  const isFocused = useIsFocused()

  const uri = url.length > 0 ? url : 'https://'
  const sourceUri = `${uri}&autoplay=${autoPlay ? 'true' : 'false'}&contentforce=true`

  const _onClick = () => {
    if (onClick) {
      onClick()
      return
    }
    setActive(true)
    setPlaying(p => !p)
  }

  return (
    <Kb.ClickableBox direction="vertical" relative={true} alignSelf="flex-start" onClick={_onClick} style={style}>
      {active && isFocused && (
        <NativeActiveVideo
          sourceUri={sourceUri}
          autoPlay={autoPlay}
          playing={playing}
          style={style}
        />
      )}
      <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([sharedStyles.absoluteContainer, {height, width}])}>
        {!playing && <Kb.ImageIcon type="icon-play-64" style={sharedStyles.playButton} />}
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}


const nativeStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      player: {
        position: 'relative',
      },
    }) as const
)

export const Video = isMobile ? NativeVideo : DesktopVideo
