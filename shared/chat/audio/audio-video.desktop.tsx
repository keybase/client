import * as React from 'react'
import type {Props} from './audio-video'

const AudioVideo = (props: Props) => {
  const {url, seekRef, paused, onPositionUpdated, onEnded} = props
  const vidRef = React.useRef<HTMLVideoElement | null>(null)
  const seek = React.useCallback(
    (seconds: number) => {
      if (vidRef.current) {
        vidRef.current.currentTime = seconds
      }
      if (paused) {
        vidRef.current?.pause()
      }
    },
    [vidRef, paused]
  )

  seekRef.current = seek
  const onTimeUpdate = React.useCallback(
    (e: any) => {
      const ct = e?.target?.currentTime ?? -1
      const dur = e?.target?.duration ?? -1
      if (dur === 0) {
        return
      }
      onPositionUpdated(ct / dur)
    },
    [onPositionUpdated]
  )

  const onEndedRaw = React.useCallback(() => {
    onEnded()
  }, [onEnded])

  const [lastPaused, setLastPaused] = React.useState(paused)
  if (lastPaused !== paused) {
    setLastPaused(paused)
    if (paused) {
      vidRef.current?.pause()
    } else {
      vidRef.current
        ?.play()
        .then(() => {})
        .catch(() => {})
    }
  }

  return (
    <video
      ref={vidRef}
      src={url}
      style={{height: 0, width: 0}}
      onTimeUpdate={onTimeUpdate}
      onEnded={onEndedRaw}
    />
  )
}

export default AudioVideo
