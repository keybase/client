import * as React from 'react'
import type {Props} from './video'
import Measure from 'react-measure'
import * as Styles from '@/styles'
import {getVideoSize, CheckURL} from './video.shared'

const Video = (props: Props) => {
  const {onUrlError} = props
  const [containerHeight, setContainerHeight] = React.useState(0)
  const [containerWidth, setContainerWidth] = React.useState(0)
  const [loadedVideoSize, setLoadedVideoSize] = React.useState(false)
  const [videoHeight, setVideoHeight] = React.useState(0)
  const [videoWidth, setVideoWidth] = React.useState(0)

  const videoRef = React.useRef<HTMLVideoElement>(null)
  const mountedRef = React.useRef(false)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const onContainerResize = ({bounds}: {bounds?: {width: number; height: number}}) => {
    if (bounds && mountedRef.current) {
      setContainerHeight(bounds.height)
      setContainerWidth(bounds.width)
    }
  }

  const onVideoClick = () => {
    if (videoRef.current) {
      videoRef.current.paused ? videoRef.current.play().catch(() => {}) : videoRef.current.pause()
    }
  }

  const onVideoLoadedmetadata = ({currentTarget}: React.SyntheticEvent<HTMLVideoElement>) => {
    if (mountedRef.current) {
      setLoadedVideoSize(true)
      setVideoHeight(currentTarget.videoHeight)
      setVideoWidth(currentTarget.videoWidth)
    }
  }

  const url = encodeURI(props.url)
  return (
    <CheckURL url={url} allowFile={props.allowFile}>
      <Measure bounds={true} onResize={onContainerResize}>
        {(p: {measureRef: (ref: Element | null) => void}) => (
          <div
            ref={p.measureRef}
            style={Styles.castStyleDesktop(Styles.collapseStyles([styles.container, props.style]))}
          >
            <video
              controlsList="nodownload nofullscreen"
              onClick={onVideoClick}
              ref={videoRef}
              controls={!props.hideControls}
              src={url}
              style={Styles.castStyleDesktop(
                Styles.collapseStyles([
                  styles.container,
                  getVideoSize({containerHeight, containerWidth, loadedVideoSize, videoHeight, videoWidth}),
                ])
              )}
              muted={props.muted ?? true}
              autoPlay={props.autoPlay ?? true}
              preload="metadata"
              onLoadedMetadata={onVideoLoadedmetadata}
              onError={onUrlError && (() => onUrlError('video loading error'))}
            />
          </div>
        )}
      </Measure>
    </CheckURL>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.flexBoxCenter,
    height: '100%',
    maxHeight: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  video: Styles.platformStyles({
    isElectron: {
      maxHeight: '100%',
      maxWidth: '100%',
      objectFit: 'contain',
      position: 'absolute',
    },
  }),
}))

export default Video
