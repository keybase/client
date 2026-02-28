import * as React from 'react'
import type {Props} from './video'
import * as Styles from '@/styles'
import {useCheckURL} from './video.shared'

const Video = (props: Props) => {
  const {onUrlError} = props

  const videoRef = React.useRef<HTMLVideoElement>(null)
  const mountedRef = React.useRef(false)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const onVideoClick = () => {
    if (videoRef.current) {
      videoRef.current.paused ? videoRef.current.play().catch(() => {}) : videoRef.current.pause()
    }
  }

  const url = encodeURI(props.url)
  const content = (
    <div style={Styles.castStyleDesktop(Styles.collapseStyles([styles.container, props.style]))}>
      <video
        controlsList="nodownload nofullscreen"
        onClick={onVideoClick}
        ref={videoRef}
        controls={!props.hideControls}
        src={url}
        style={styles.container}
        muted={props.muted ?? true}
        autoPlay={props.autoPlay ?? true}
        preload="metadata"
        onError={onUrlError && (() => onUrlError('video loading error'))}
      />
    </div>
  )
  return useCheckURL(content, url, props.allowFile)
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
