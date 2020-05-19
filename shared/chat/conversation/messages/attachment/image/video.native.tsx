import * as React from 'react'
import {Props} from './video'
import RNVideo from 'react-native-video'

const videoSrcToSource = (videoSrc: string) => {
  const uri = videoSrc || 'https://'
  return {
    uri: `${uri}&contentforce=true&poster=${encodeURIComponent(videoSrc)}`,
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
      onLoad={props.onLoadedMetadata}
      onProgress={({currentTime}) => props.onProgress?.(currentTime)}
      source={videoSrcToSource(props.videoSrc)}
      paused={paused}
      progressUpdateInterval={props.progressUpdateInterval}
      style={props.style}
    />
  )
}

export default Video
