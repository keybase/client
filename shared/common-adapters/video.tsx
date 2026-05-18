import * as React from 'react'
import type {Props} from './video.shared'
import * as Styles from '@/styles'
import {Box2} from './box'
import {StatusBar} from 'react-native'
import {useVideoPlayer, VideoView} from 'expo-video'
import {useEventListener} from 'expo'
import {useCheckURL} from './video.shared'

// Desktop: normalize file paths to file:// URLs
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

// Stub type for desktop video element (avoids dom lib dependency in native tsconfig)
type VideoElementRef = {
  paused?: boolean
  play?: () => Promise<void>
  pause?: () => void
}

// Native: delay mount to avoid navigation animation race
const DelayMount = ({children}: {children: React.ReactNode}): React.ReactNode => {
  const [mount, setMount] = React.useState(false)
  React.useEffect(() => {
    const id = setTimeout(() => setMount(true), 500)
    return () => clearTimeout(id)
  }, [])
  return mount && children
}

const DesktopVideo = (props: Props) => {
  const {onUrlError} = props
  const videoRef = React.useRef<VideoElementRef>(null)
  const mountedRef = React.useRef(false)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const onVideoClick = () => {
    if (videoRef.current?.paused) {
      videoRef.current.play?.().catch(() => {})
    } else {
      videoRef.current?.pause?.()
    }
  }

  const url = normalizeURL(props.url)
  const content = (
    <div style={Styles.castStyleDesktop(Styles.collapseStyles([styles.container, props.style]))}>
      <video
        controlsList="nodownload nofullscreen"
        onClick={onVideoClick}
        ref={videoRef as React.RefObject<HTMLVideoElement>}
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

const NativeVideo = (props: Props) => {
  const {url: _url, allowFile, muted, onUrlError, autoPlay} = props
  const url = Styles.urlEscapeFilePath(_url)
  const uri = allowFile ? Styles.normalizePath(url) : url

  const player = useVideoPlayer(uri, p => {
    p.muted = muted ?? false
    if (autoPlay ?? true) {
      p.play()
    }
  })

  useEventListener(player, 'statusChange', ({status, error}) => {
    if (status === 'error' && error && onUrlError) {
      onUrlError(JSON.stringify(error))
    }
  })

  const content = (
    <DelayMount>
      <Box2 direction="horizontal" centerChildren={true} style={styles.container}>
        <VideoView
          player={player}
          nativeControls={true}
          contentFit="contain"
          onFullscreenExit={() => {
            StatusBar.setHidden(false)
          }}
          style={styles.video}
        />
      </Box2>
    </DelayMount>
  )

  return useCheckURL(content, url, allowFile)
}

const Video = (props: Props) => {
  if (!isMobile) return <DesktopVideo {...props} />
  return <NativeVideo {...props} />
}

export default Video

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
  video: {
    height: '100%',
    width: '100%',
  },
}))
