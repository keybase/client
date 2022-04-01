import * as React from 'react'
import * as Container from '../../util/container'
import {Audio} from 'expo-av'
import type {Props} from './audio-video'

const AudioVideo = (props: Props) => {
  const {url, seekRef, paused} = props
  const soundRef = React.useRef<Audio.Sound | null>(null)
  React.useEffect(() => {
    if (url) {
      Audio.Sound.createAsync({uri: url})
        .then(({sound}) => {
          soundRef.current = sound
        })
        .catch(() => {})
    }
  }, [soundRef, url])

  const seek = React.useCallback(
    (seconds: number) => {
      soundRef.current
        ?.setPositionAsync(seconds * 1000)
        .then(() => {})
        .catch(() => {})
      if (paused) {
        soundRef.current
          ?.pauseAsync()
          .then(() => {})
          .catch(() => {})
      }
    },
    [soundRef, paused]
  )
  React.useEffect(() => {
    seekRef.current = seek
  }, [seekRef, seek])

  const lastPaused = Container.usePrevious(paused)
  React.useEffect(() => {
    if (!soundRef.current || paused === lastPaused) {
      return
    }

    if (paused) {
      soundRef.current
        ?.pauseAsync()
        .then(() => {})
        .catch(() => {})
    } else {
      soundRef.current
        ?.playAsync()
        .then(() => {})
        .catch(() => {})
    }
  }, [paused, lastPaused, soundRef])

  return null
}

export default AudioVideo
