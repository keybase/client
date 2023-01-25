import * as React from 'react'
import * as Kb from '../../../../../../../common-adapters/index'
import * as Styles from '../../../../../../../styles'
import logger from '../../../../../../../logger'
import {Video as AVVideo, ResizeMode} from 'expo-av'
import type {Props} from './video'

export const Video = (props: Props) => {
  const {autoPlay, onClick, url, style, width, height} = props
  const [playing, setPlaying] = React.useState(autoPlay)

  React.useEffect(() => {
    setPlaying(autoPlay)
  }, [url, autoPlay])

  const vidRef = React.useRef<AVVideo>(null)

  const _onClick = React.useCallback(() => {
    if (onClick) {
      onClick()
      return
    }
    setPlaying(p => !p)
  }, [setPlaying, onClick])

  /*
    The video library thinks any URI that doesn't start with /https?:// to be an asset bundled
    with the app, and will straight crash of that is not true. Solution here is if we somehow end up with a
    blank URL in a native video component, then just put some bogus string in there that at least doesn't
    send the library down the crasher path.
    */
  const uri = url.length > 0 ? url : 'https://'
  const source = {
    uri: `${uri}&autoplay=${autoPlay ? 'true' : 'false'}&contentforce=true`,
  }
  return (
    <Kb.ClickableBox onClick={_onClick} style={Styles.collapseStyles([style, styles.container])}>
      <AVVideo
        ref={vidRef}
        source={source}
        onError={e => {
          logger.error(`Error loading vid: ${JSON.stringify(e)}`)
        }}
        resizeMode={ResizeMode.CONTAIN}
        style={Styles.collapseStyles([styles.player, style])}
        isLooping={true}
        isMuted={true}
        shouldPlay={playing}
      />
      <Kb.Box style={Styles.collapseStyles([styles.absoluteContainer, {height, width}])}>
        {!playing && <Kb.Icon type="icon-play-64" style={styles.playButton} />}
      </Kb.Box>
    </Kb.ClickableBox>
  )
}

const styles = Styles.styleSheetCreate(
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
    } as const)
)
