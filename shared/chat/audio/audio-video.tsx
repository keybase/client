import * as React from 'react'
import {useAudioPlayer} from 'expo-audio'
import {useEventListener} from 'expo'

type Props = {
  url: string
  paused: boolean
  onPositionUpdated: (ratio: number) => void
  onEnded: () => void
}

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

  // runs on mount too: this mounts on the first tap with paused=false, and a new player starts paused
  React.useEffect(() => {
    if (paused) {
      player.pause()
    } else {
      player.play()
    }
  }, [paused, player])

  return null
}

type VideoEl = {pause: () => void; play: () => Promise<void>; currentTime: number; duration: number}

const DesktopAudioVideo = (props: Props) => {
  const {url, paused, onPositionUpdated, onEnded} = props
  const vidRef = React.useRef<VideoEl | null>(null)
  // a new <video> starts paused, so mounting with paused=false (the first tap) must still call play()
  const lastPausedRef = React.useRef(true)

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
    const dur = vidRef.current?.duration
    if (!dur) return
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
