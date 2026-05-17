import * as React from 'react'
import * as Styles from '@/styles'
import type {Props} from './audio-video.shared'

type VideoEl = {
  pause: () => void
  play: () => Promise<void>
  currentTime: number
  duration: number
}

const MobileAudioVideo = (props: Props) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {useAudioPlayer} = require('expo-audio') as typeof import('expo-audio')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {useEventListener} = require('expo') as typeof import('expo')

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

  const onTimeUpdate = (e: React.SyntheticEvent<{currentTime: number; duration: number}>) => {
    const ct = e.currentTarget.currentTime
    const dur = e.currentTarget.duration
    if (dur === 0) return
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

const AudioVideo = Styles.isMobile ? MobileAudioVideo : DesktopAudioVideo
export default AudioVideo
