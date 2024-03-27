import * as React from 'react'
import {Audio, type AVPlaybackStatus} from 'expo-av'
import type {Props} from './audio-video'

const AudioVideo = (props: Props) => {
  const {url, seekRef, paused, onPositionUpdated, onEnded} = props
  const [sound, setSound] = React.useState<Audio.Sound | undefined>()

  React.useEffect(() => {
    return () => {
      sound
        ?.unloadAsync()
        .then(() => {})
        .catch(() => {})
    }
  }, [sound])

  const seek = React.useCallback(
    (seconds: number) => {
      sound
        ?.setPositionAsync(seconds * 1000)
        .then(() => {})
        .catch(() => {})
      if (paused) {
        sound
          ?.pauseAsync()
          .then(() => {})
          .catch(() => {})
      }
    },
    [sound, paused]
  )

  const onPlaybackStatusUpdate = React.useCallback(
    (e: AVPlaybackStatus) => {
      if (!e.isLoaded) return
      if (e.isPlaying) {
        const ct = e.positionMillis
        const dur = e.durationMillis ?? 0
        if (dur === 0) {
          return
        }
        onPositionUpdated(ct / dur)
      } else if (e.didJustFinish) {
        onEnded()
        sound
          ?.setPositionAsync(0)
          .then(() => {})
          .catch(() => {})
      }
    },
    [onPositionUpdated, onEnded, sound]
  )

  React.useEffect(() => {
    sound?.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate)
  }, [sound, onPlaybackStatusUpdate])

  seekRef.current = seek

  const [lastPaused, setLastPaused] = React.useState(paused)

  if (lastPaused !== paused) {
    setLastPaused(paused)
    const f = async () => {
      let s = sound
      if (!sound) {
        const {sound: newSound} = await Audio.Sound.createAsync({uri: url})
        s = newSound
        setSound(newSound)
        await newSound.setProgressUpdateIntervalAsync(100)
      }

      if (paused) {
        await s?.pauseAsync()
      } else {
        await s?.playAsync()
      }
    }
    f()
      .then(() => {})
      .catch((e: unknown) => {
        console.error('audio play fail', e)
      })
  }

  return null
}

export default AudioVideo
