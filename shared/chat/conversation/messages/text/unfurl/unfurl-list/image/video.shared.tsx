import * as Kb from '@/common-adapters'
import * as React from 'react'

export type Props = {
  autoPlay: boolean
  height: number
  style: object
  onClick?: () => void
  url: string
  width: number
}

export const usePlayState = (url: string, autoPlay: boolean) => {
  const [playing, setPlaying] = React.useState(autoPlay)
  const [lastAutoPlay, setLastAutoPlay] = React.useState(autoPlay)
  const [lastUrl, setLastUrl] = React.useState(url)
  if (lastAutoPlay !== autoPlay || lastUrl !== url) {
    setLastAutoPlay(autoPlay)
    setLastUrl(url)
    setPlaying(autoPlay)
  }
  return {playing, setPlaying}
}

export const sharedStyles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      absoluteContainer: {
        left: 0,
        position: 'absolute',
        top: 0,
      },
      playButton: {
        bottom: '50%',
        left: '50%',
        marginBottom: -32,
        marginLeft: -32,
        marginRight: -32,
        marginTop: -32,
        position: 'absolute',
        right: '50%',
        top: '50%',
      },
    }) as const
)
