import * as React from 'react'
import * as Styles from '@/styles'
import {normalizeFilePathURL} from '@/util/file-url'
import {Box2} from './box'
import Text from './text'
import {StatusBar} from 'react-native'
import {useVideoPlayer, VideoView} from 'expo-video'
import {useEventListener} from 'expo'

type Props = {
  hideControls?: boolean
  onUrlError?: (err: string) => void
  style?: Styles.StylesCrossPlatform
  url: string
  allowFile?: boolean
  muted?: boolean
  autoPlay?: boolean
}

const allowedHosts = new Set(['127.0.0.1', 'localhost'])
const hasAllowedChars = (url: string) => /^[a-zA-Z0-9=.%:?/&_-]*$/.test(url)
const hasScheme = (url: string) => /^[a-z][a-z\d+.-]*:/i.test(url)

const isAllowedHostURL = (url: string) => {
  try {
    const parsed = new URL(url.startsWith('//') ? `http:${url}` : url)
    if (allowedHosts.has(parsed.hostname.toLowerCase())) {
      return true
    }
  } catch {}
  return false
}

const isAllowedFilePath = (url: string, allowFile?: boolean) => {
  if (!allowFile || url.startsWith('//')) {
    return false
  }

  if (/^[a-z]:\//i.test(url)) {
    return true
  }

  if (!hasScheme(url)) {
    return true
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'file:' && parsed.hostname === '') {
      return true
    }
  } catch {}

  return false
}

const urlIsOK = (url: string, allowFile?: boolean) =>
  isAllowedHostURL(url) || (hasAllowedChars(url) && isAllowedFilePath(url, allowFile))

const useCheckURL = (children: React.ReactElement, url: string, allowFile?: boolean) => {
  const ok = urlIsOK(url, allowFile)
  return ok ? (
    children
  ) : (
    <Box2 direction="horizontal" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Text type="BodySmall">Invalid URL: {url}</Text>
    </Box2>
  )
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

  const url = normalizeFilePathURL(props.url)
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
    ...Styles.size('100%'),
    maxHeight: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  video: {
    ...Styles.size('100%'),
  },
}))
