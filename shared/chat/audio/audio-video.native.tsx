import * as React from 'react'
import {useAudioPlayer} from 'expo-audio'
import {useEventListener} from 'expo'
import type {Props} from './audio-video'

const AudioVideo = (props: Props) => {
  const {url, paused, onPositionUpdated, onEnded} = props
  const player = useAudioPlayer(url)

  useEventListener(player, 'playbackStatusUpdate', status => {
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

export default AudioVideo
