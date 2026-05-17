import * as React from 'react'
import * as Styles from '@/styles'
import {useAudioPlayer} from 'expo-audio'
import {useEventListener} from 'expo'
import type {Props} from './audio-video.shared'

type VideoEl = {
  pause: () => void
  play: () => Promise<void>
  currentTime: number
  duration: number
}

const AudioVideo = (props: Props) => {
  const {url, paused, onPositionUpdated, onEnded} = props

  const vidRef = React.useRef<VideoEl | null>(null)
  const lastPausedRef = React.useRef(paused)

  React.useEffect(() => {
    if (Styles.isMobile) return
    if (lastPausedRef.current === paused) {
      return
    }
    lastPausedRef.current = paused
    if (paused) {
      vidRef.current?.pause()
    } else {
      vidRef.current
        ?.play()
        .then(() => {})
        .catch(() => {})
    }
  }, [paused])

  const player = useAudioPlayer(Styles.isMobile ? url : '')

  useEventListener(player, 'playbackStatusUpdate', status => {
    if (!Styles.isMobile) return
    if (status.playing && status.duration > 0) {
      onPositionUpdated(status.currentTime / status.duration)
    }
    if (status.didJustFinish) {
      onEnded()
      void player.seekTo(0)
    }
  })

  const [lastPaused, setLastPaused] = React.useState(paused)

  if (Styles.isMobile) {
    if (lastPaused !== paused) {
      setLastPaused(paused)
      if (paused) {
        player.pause()
      } else {
        player.play()
      }
    }
    return null
  }

  const onTimeUpdate = (e: React.SyntheticEvent<{currentTime: number; duration: number}>) => {
    const ct = e.currentTarget.currentTime
    const dur = e.currentTarget.duration
    if (dur === 0) {
      return
    }
    onPositionUpdated(ct / dur)
  }

  return (
    <video
      ref={vidRef as unknown as React.Ref<HTMLVideoElement>}
      src={url}
      style={{height: 0, width: 0}}
      onTimeUpdate={onTimeUpdate as React.ReactEventHandler<HTMLVideoElement>}
      onEnded={onEnded}
    />
  )
}

export default AudioVideo
