import * as React from 'react'
import * as Kb from '../../../../../../../common-adapters/index'
import * as Styles from '../../../../../../../styles'
import type {Props} from './video'

export const Video = (p: Props) => {
  const {autoPlay, onClick, height, width, style, url} = p
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = React.useState(autoPlay)
  React.useEffect(() => {
    setPlaying(autoPlay)
  }, [url, autoPlay])
  const _onClick = React.useCallback(() => {
    if (onClick) {
      onClick()
      return
    }
    if (!videoRef.current) {
      return
    }
    if (!playing) {
      videoRef.current
        .play()
        .then(() => {})
        .catch(() => {})
    } else {
      videoRef.current.pause()
    }
    setPlaying(p => !p)
  }, [playing, onClick])

  return (
    <Kb.Box2 direction="horizontal" style={styles.container}>
      <Kb.Box style={Styles.collapseStyles([styles.absoluteContainer, {height, width}])}>
        {!playing && <Kb.Icon type="icon-play-64" style={styles.playButton} />}
      </Kb.Box>
      <video
        ref={videoRef}
        onClick={_onClick}
        autoPlay={autoPlay}
        muted={true}
        src={url}
        style={style}
        loop={true}
      />
    </Kb.Box2>
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
    } as const)
)
