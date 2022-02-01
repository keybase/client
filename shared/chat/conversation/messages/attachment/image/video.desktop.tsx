import * as React from 'react'
import {Props} from './video'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

const Video = (props: Props) => {
  const ref = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    if (!ref.current) {
      return
    }
    // ref.current.setAttribute('controls', 'controls')
    ref.current.setAttribute('disablepictureinpicture', 'disablepictureinpicture')
  }, [ref])

  const {playFromSecondsOrPause} = props
  React.useEffect(() => {
    if (!ref.current) {
      return
    }
    if (playFromSecondsOrPause === undefined) {
      ref.current.pause()
    } else {
      if (ref.current.currentTime === playFromSecondsOrPause) {
        ref.current.play()
      } else {
        ref.current.currentTime = playFromSecondsOrPause
        // delay play() to after onSeeked to avoid showing an old position.
      }
    }
  }, [ref, playFromSecondsOrPause])

  Kb.useInterval(() => {
    ref.current && props.onProgress?.(ref.current.currentTime)
  }, props.progressUpdateInterval || 250)

  // This is used to control opacity. It means we're paused after at least
  // playing once. This is different from just the playing state since we
  // need to show a poster in the initial state. If we are paused after we
  // started playing, set the opacity to 0 so we can delay rendering the
  // video until we've completed seeking.
  const [paused, setPaused] = React.useState(false)

  return (
    <Kb.Animated to={{opacity: paused ? 0 : 1}} from={{opacity: 0}}>
      {({opacity}) => (
        <video
          ref={ref}
          loop={true}
          onSeeked={() => ref.current?.play()}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onMouseEnter={() => ref.current?.setAttribute('controls', 'controls')}
          onMouseLeave={() => ref.current?.removeAttribute('controls')}
          poster={props.posterSrc}
          muted={props.muted}
          onLoadedMetadata={props.onReady}
          onLoadStart={props.onLoadStart}
          controlsList="nodownload nofullscreen noremoteplayback"
          style={Styles.collapseStyles([props.style, {opacity}])}
        >
          <source src={props.videoSrc} />
        </video>
      )}
    </Kb.Animated>
  )
}

export default Video

export const Poster = () => false
