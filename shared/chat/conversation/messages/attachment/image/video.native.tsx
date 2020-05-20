import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import {PosterProps, Props} from './video'
import RNVideo from 'react-native-video'

const posterAndVideoSrcToSource = (posterSrc: string | undefined, videoSrc: string) => {
  const uri = videoSrc || 'https://'
  const posterParam = posterSrc ? `&poster=${encodeURIComponent(posterSrc)}` : ''
  return {
    uri: `${uri}&contentforce=true${posterParam}`,
  }
}

const Video = (props: Props) => {
  const ref = React.useRef<RNVideo>(null)
  const [paused, setPaused] = React.useState(true)

  const {playFromSecondsOrPause} = props
  React.useEffect(() => {
    if (!ref.current) {
      return
    }
    if (playFromSecondsOrPause === undefined) {
      setPaused(true)
    } else {
      ref.current.seek(playFromSecondsOrPause)
      setPaused(false)
    }
  }, [ref, playFromSecondsOrPause])

  return (
    <RNVideo
      ref={ref}
      repeat={true}
      fullscreen={props.mobileFullscreen}
      onFullscreenPlayerDidDismiss={props.mobileOnDismissFullscreen}
      poster={props.posterSrc}
      muted={props.muted}
      onLoadStart={props.onLoadStart}
      onReadyForDisplay={props.onReady}
      onProgress={({currentTime}) => props.onProgress?.(currentTime)}
      source={posterAndVideoSrcToSource(props.posterSrc, props.videoSrc)}
      paused={paused}
      progressUpdateInterval={props.progressUpdateInterval}
      style={props.style}
    />
  )
}

export const Poster = (props: PosterProps) => {
  const dimensions = {height: props.height, width: props.width}
  return (
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      style={Styles.collapseStyles([styles.container, dimensions])}
    >
      <Kb.NativeFastImage
        source={{uri: props.posterSrc}}
        resizeMode="cover"
        style={Styles.collapseStyles([styles.image, dimensions])}
      />
      <Kb.Icon type="icon-play-64" style={styles.icon} />
    </Kb.Box2>
  )
}

export default Video

const styles = Styles.styleSheetCreate(() => ({
  container: {position: 'relative'},
  icon: {},
  image: {position: 'absolute'},
}))
