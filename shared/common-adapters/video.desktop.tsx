import * as React from 'react'
import type {Props} from './video'
import * as Styles from '@/styles'
import {useCheckURL} from './video.shared'

const normalizeURL = (url: string) => {
  const isWindowsPath = /^[a-zA-Z]:[\\/]/.test(url)
  if (url.startsWith('/') || isWindowsPath) {
    let path = url.replace(/\\/g, '/')
    if (isWindowsPath && !path.startsWith('/')) {
      path = '/' + path
    }
    return encodeURI(`file://${path}`).replace(/#/g, '%23')
  }
  if (url.startsWith('file://') && (url.includes(' ') || url.includes('#'))) {
    return encodeURI(url).replace(/#/g, '%23')
  }
  return url
}

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
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {})
      } else {
        videoRef.current.pause()
      }
    }
  }

  const url = normalizeURL(props.url)
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
}))

export default Video
