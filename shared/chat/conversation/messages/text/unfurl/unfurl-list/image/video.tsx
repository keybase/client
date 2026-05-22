import * as Kb from '@/common-adapters/index'
import * as React from 'react'
import type {Props} from './video.shared'
import {usePlayState, sharedStyles} from './video.shared'
import logger from '@/logger'
import {useVideoPlayer, VideoView} from 'expo-video'

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
    <Kb.Box2 direction="horizontal" relative={true} style={desktopStyles.container}>
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
    p.loop = true
    p.muted = true
    if (autoPlay) {
      p.play()
    }
  })

  React.useEffect(() => {
    if (playing) {
      player.play()
    } else {
      player.pause()
    }
  }, [player, playing])

  React.useEffect(() => {
    const sub = player.addListener('statusChange', ({status, error}) => {
      if (status === 'error' && error) {
        logger.error(`Error loading vid: ${JSON.stringify(error)}`)
      }
    })
    return () => sub.remove()
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
    <Kb.ClickableBox onClick={_onClick} style={Kb.Styles.collapseStyles([style, nativeStyles.container])}>
      {active && (
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

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignSelf: 'flex-start',
      },
    }) as const
)

const nativeStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignSelf: 'flex-start',
        position: 'relative',
      },
      player: {
        position: 'relative',
      },
    }) as const
)

export const Video = isMobile ? NativeVideo : DesktopVideo
