import * as React from 'react'
import {Audio} from 'expo-av'
import type {Props} from './audio-video'

const AudioVideo = (props: Props) => {
  const {url, seekRef} = props
  const soundRef = React.useRef<Audio.Sound | null>(null)
  const seek = React.useCallback(
    (seconds: number) => {
      soundRef.current
        ?.playFromPositionAsync(seconds * 1000)
        .then(() => {})
        .catch(() => {})
    },
    [soundRef]
  )

  seekRef.current = seek

  React.useEffect(() => {
    if (!url) {
      return
    }
    const play = async () => {
      const {sound} = await Audio.Sound.createAsync({uri: url})
      soundRef.current = sound
      await sound.playAsync()
    }
    play()
      .then(() => {})
      .catch(() => {})
  }, [soundRef, url])
  return null
}

export default AudioVideo
