import * as React from 'react'
import type {Props} from './audio-video'
import * as Container from '../../util/container'

const AudioVideo = (props: Props) => {
  const {url, seekRef, paused} = props
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
  const lastPaused = Container.usePrevious(paused)
  React.useEffect(() => {
    if (!vidRef.current || paused === lastPaused) {
      return
    }

    if (paused) {
      vidRef.current.pause()
    } else {
      vidRef.current
        .play()
        .then(() => {})
        .catch(() => {})
    }
  }, [paused, lastPaused, vidRef])

  return <video ref={vidRef} src={url} style={{height: 0, width: 0}} />
}

export default AudioVideo
