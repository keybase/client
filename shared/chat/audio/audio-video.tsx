import * as React from 'react'
import {useAudioPlayer} from 'expo-audio'
import {useEventListener} from 'expo'
import type {Props} from './audio-video.shared'

const MobileAudioVideo = (props: Props) => {
  const {url, paused, onPositionUpdated, onEnded} = props
  const player = useAudioPlayer(url)

  useEventListener(player, 'playbackStatusUpdate', (status: {playing: boolean; duration: number; currentTime: number; didJustFinish: boolean}) => {
    if (status.playing && status.duration > 0) {
      onPositionUpdated(status.currentTime / status.duration)
    }
    if (status.didJustFinish) {
      onEnded()
      void player.seekTo(0)
    }
  })

  const [lastPaused, setLastPaused] = React.useState(paused)
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

type VideoEl = {pause: () => void; play: () => Promise<void>; currentTime: number; duration: number}

const DesktopAudioVideo = (props: Props) => {
  const {url, paused, onPositionUpdated, onEnded} = props
  const vidRef = React.useRef<VideoEl | null>(null)
  const lastPausedRef = React.useRef(paused)

  React.useEffect(() => {
    if (lastPausedRef.current === paused) return
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

  const onTimeUpdate = () => {
    const ct = vidRef.current?.currentTime ?? 0
    const dur = vidRef.current?.duration ?? 0
    if (dur === 0) return
    onPositionUpdated(ct / dur)
  }

  return (
    <video
      ref={vidRef as React.Ref<HTMLVideoElement>}
      src={url}
      style={{height: 0, width: 0}}
      onTimeUpdate={onTimeUpdate}
      onEnded={onEnded}
    />
  )
}

const AudioVideo = isMobile ? MobileAudioVideo : DesktopAudioVideo
export default AudioVideo
