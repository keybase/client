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

const NativeVideo = (props: Props) => {
  const {autoPlay, onClick, url, style, width, height} = props
  const {playing, setPlaying} = usePlayState(url, autoPlay)

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
  }, [player])

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
