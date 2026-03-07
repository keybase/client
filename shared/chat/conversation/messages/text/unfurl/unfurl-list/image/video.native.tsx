import * as React from 'react'
import * as Kb from '@/common-adapters/index'
import logger from '@/logger'
import {useVideoPlayer, VideoView} from 'expo-video'
import type {Props} from './video'

export const Video = (props: Props) => {
  const {autoPlay, onClick, url, style, width, height} = props
  const [playing, setPlaying] = React.useState(autoPlay)
  const [lastAutoPlay, setLastAutoPlay] = React.useState(autoPlay)
  const [lastUrl, setLastUrl] = React.useState(url)

  if (lastAutoPlay !== autoPlay || lastUrl !== url) {
    setLastAutoPlay(autoPlay)
    setLastUrl(url)
    setPlaying(autoPlay)
  }

  /*
    The video library thinks any URI that doesn't start with /https?:// to be an asset bundled
    with the app, and will straight crash of that is not true. Solution here is if we somehow end up with a
    blank URL in a native video component, then just put some bogus string in there that at least doesn't
    send the library down the crasher path.
    */
  const uri = url.length > 0 ? url : 'https://'
  const sourceUri = `${uri}&autoplay=${autoPlay ? 'true' : 'false'}&contentforce=true`

  const player = useVideoPlayer(sourceUri, p => {
    p.loop = true
    p.muted = true
    if (autoPlay) {
      p.play()
    }
  })

  React.useEffect(() => {
    if (playing) {
      player.play()
    } else {
      player.pause()
    }
  }, [player, playing])

  // Handle errors
  React.useEffect(() => {
    const sub = player.addListener('statusChange', ({status, error}) => {
      if (status === 'error' && error) {
        logger.error(`Error loading vid: ${JSON.stringify(error)}`)
      }
    })
    return () => sub.remove()
  }, [player])

  const _onClick = () => {
    if (onClick) {
      onClick()
      return
    }
    setPlaying(p => !p)
  }

  return (
    <Kb.ClickableBox onClick={_onClick} style={Kb.Styles.collapseStyles([style, styles.container])}>
      <VideoView
        player={player}
        nativeControls={false}
        contentFit="contain"
        style={Kb.Styles.collapseStyles([styles.player, style])}
      />
      <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([styles.absoluteContainer, {height, width}])}>
        {!playing && <Kb.ImageIcon type="icon-play-64" style={styles.playButton} />}
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      absoluteContainer: {
        left: 0,
        position: 'absolute',
        top: 0,
      },
      container: {
        alignSelf: 'flex-start',
        position: 'relative',
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
      player: {
        position: 'relative',
      },
    }) as const
)
