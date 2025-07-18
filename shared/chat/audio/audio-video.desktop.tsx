import * as React from 'react'
import type {Props} from './audio-video'

const AudioVideo = (props: Props) => {
  const {url, paused, onPositionUpdated, onEnded} = props
  const vidRef = React.useRef<HTMLVideoElement | null>(null)

  const onTimeUpdate = React.useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const ct = e.currentTarget.currentTime
      const dur = e.currentTarget.duration
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

  const lastPausedRef = React.useRef(paused)
  React.useEffect(() => {
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
