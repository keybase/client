import * as Kb from '@/common-adapters/index'
import * as React from 'react'
import type {Props} from './video.shared'

// Stub type to avoid dom lib dependency in native tsconfig
type VideoElementRef = {
  play: () => Promise<void>
  pause: () => void
}

const DesktopVideo = (p: Props) => {
  const {autoPlay, onClick, height, width, style, url} = p
  const videoRef = React.useRef<VideoElementRef | null>(null)
  const [playing, setPlaying] = React.useState(autoPlay)
  const [lastAutoPlay, setLastAutoPlay] = React.useState(autoPlay)
  const [lastUrl, setLastUrl] = React.useState(url)

  if (lastAutoPlay !== autoPlay || lastUrl !== url) {
    setLastAutoPlay(autoPlay)
    setLastUrl(url)
    setPlaying(autoPlay)
  }

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
      <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([desktopStyles.absoluteContainer, {height, width}])}>
        {!playing && <Kb.ImageIcon type="icon-play-64" style={desktopStyles.playButton} />}
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

const NativeVideo = (props: Props) => {
  const logger = require('@/logger').default as {error: (s: string) => void}
  const {useVideoPlayer, VideoView} = require('expo-video') as {
    useVideoPlayer: (uri: string, cb: (p: {loop: boolean; muted: boolean; play: () => void}) => void) => {
      play: () => void
      pause: () => void
      addListener: (event: string, cb: (data: {status: string; error?: unknown}) => void) => {remove: () => void}
    }
    VideoView: React.ComponentType<{
      player: ReturnType<typeof useVideoPlayer>
      nativeControls: boolean
      contentFit: string
      style: object
    }>
  }

  const {autoPlay, onClick, url, style, width, height} = props
  const [playing, setPlaying] = React.useState(autoPlay)
  const [lastAutoPlay, setLastAutoPlay] = React.useState(autoPlay)
  const [lastUrl, setLastUrl] = React.useState(url)

  if (lastAutoPlay !== autoPlay || lastUrl !== url) {
    setLastAutoPlay(autoPlay)
    setLastUrl(url)
    setPlaying(autoPlay)
  }

  const uri = url.length > 0 ? url : 'https://'
  const sourceUri = `${uri}&autoplay=${autoPlay ? 'true' : 'false'}&contentforce=true`

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
  }, [player, logger])

  const _onClick = () => {
    if (onClick) {
      onClick()
      return
    }
    setPlaying(p => !p)
  }

  return (
    <Kb.ClickableBox onClick={_onClick} style={Kb.Styles.collapseStyles([style, nativeStyles.container])}>
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="contain"
        style={(Kb.Styles.collapseStyles([nativeStyles.player, style]) ?? {}) as object}
      />
      <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([nativeStyles.absoluteContainer, {height, width}])}>
        {!playing && <Kb.ImageIcon type="icon-play-64" style={nativeStyles.playButton} />}
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const desktopStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      absoluteContainer: {
        left: 0,
        position: 'absolute',
        top: 0,
      },
      container: {
        alignSelf: 'flex-start',
      },
      playButton: {
        bottom: '50%',
        left: '50%',
        marginBottom: -32,
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        position: 'absolute',
        right: '50%',
        top: '50%',
      },
    }) as const
)

const nativeStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      absoluteContainer: {
        left: 0,
        position: 'absolute',
        top: 0,
      },
      container: {
        alignSelf: 'flex-start',
        position: 'relative',
      },
      playButton: {
        bottom: '50%',
        left: '50%',
        marginBottom: -32,
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        position: 'absolute',
        right: '50%',
        top: '50%',
      },
      player: {
        position: 'relative',
      },
    }) as const
)

export const Video = isMobile ? NativeVideo : DesktopVideo
