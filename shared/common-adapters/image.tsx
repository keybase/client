import * as React from 'react'
import * as Styles from '@/styles'
import type {ImageLoadEventData, ImageErrorEventData} from 'expo-image'
import {Image as ExpoImage} from 'expo-image'
import LoadingStateView from './loading-state-view'
import type {StylesCrossPlatform} from '@/styles'
import {useConfigState} from '@/stores/config'
import {useShellState} from '@/stores/shell'

type Props = {
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  src: number | string | Array<{uri: string; width: number; height: number}>
  style?: StylesCrossPlatform
  showLoadingStateUntilLoaded?: boolean
  onLoad?: (e: {target?: unknown; source?: {width: number; height: number}}) => void
  onError?: () => void
  allowDownscaling?: boolean
}

const onDragStart = (e: React.BaseSyntheticEvent) => e.preventDefault()

const DesktopImage = (p: Props) => {
  const {showLoadingStateUntilLoaded, src, onLoad, onError} = p
  const [loading, setLoading] = React.useState(true)
  const _onLoad = (e: React.BaseSyntheticEvent) => {
    setLoading(false)
    onLoad?.(e)
  }
  const style = {
    ...p.style,
    ...(showLoadingStateUntilLoaded && loading ? styles.absolute : {}),
    opacity: showLoadingStateUntilLoaded && loading ? 0 : 1,
  } as const

  return (
    <>
      <img
        loading="lazy"
        src={typeof src === 'string' ? src : undefined}
        style={Styles.castStyleDesktop(style)}
        onLoad={_onLoad}
        onError={onError}
        onDragStart={onDragStart}
      />
      {showLoadingStateUntilLoaded ? <LoadingStateView loading={loading} /> : null}
    </>
  )
}

// Srcs served by the local service http server can fail transiently: iOS stops that server
// on background/inactive and restarts it (new token, possibly new port) on foreground, so a
// load racing the restart gets connection refused. Those are worth retrying; remote srcs keep
// the old fail-once behavior.
const isLocalhostSrc = (src: Props['src']): src is string =>
  typeof src === 'string' && src.startsWith('http://127.0.0.1:')

const maxRetries = 3

const NativeImage = (p: Props) => {
  const {showLoadingStateUntilLoaded, src, onLoad, onError, style, contentFit = 'contain', allowDownscaling} = p
  const [loading, setLoading] = React.useState(!showLoadingStateUntilLoaded)
  const [lastSrc, setLastSrc] = React.useState(src)
  const [attempt, setAttempt] = React.useState(0)
  const retryable = isLocalhostSrc(src)
  const failedRef = React.useRef(false)
  const triesRef = React.useRef(0)
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const _onLoad = (e?: ImageLoadEventData) => {
    triesRef.current = 0
    failedRef.current = false
    setLoading(false)
    onLoad?.(e ?? {})
  }

  if (lastSrc !== src) {
    setLastSrc(src)
    setLoading(true)
    setAttempt(0)
  }

  React.useEffect(() => {
    triesRef.current = 0
    failedRef.current = false
    clearTimeout(timerRef.current)
  }, [src])

  const _onError = (e?: ImageErrorEventData) => {
    console.log('Image load error', e?.error)
    if (retryable && triesRef.current < maxRetries) {
      triesRef.current++
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setAttempt(a => a + 1)
      }, 1000 * 2 ** (triesRef.current - 1))
      return
    }
    setLoading(false)
    failedRef.current = true
    onError?.()
  }

  // after retries are exhausted, a server restart (new address/token) or returning to the
  // foreground means the server is likely back: start the retry cycle over
  React.useEffect(() => {
    if (!retryable) return
    const maybeHeal = () => {
      if (!failedRef.current) return
      // server is stopped while inactive/backgrounded; the active flip will land here again
      if (useShellState.getState().mobileAppState !== 'active') return
      failedRef.current = false
      triesRef.current = 0
      setLoading(true)
      setAttempt(a => a + 1)
    }
    const unsubConfig = useConfigState.subscribe((s, prev) => {
      if (s.httpSrv.address !== prev.httpSrv.address || s.httpSrv.token !== prev.httpSrv.token) {
        maybeHeal()
      }
    })
    const unsubShell = useShellState.subscribe((s, prev) => {
      if (s.mobileAppState === 'active' && prev.mobileAppState !== 'active') {
        maybeHeal()
      }
    })
    return () => {
      unsubConfig()
      unsubShell()
      clearTimeout(timerRef.current)
    }
  }, [retryable])

  // cache-buster forces expo-image to actually refetch; recyclingKey stays on the original
  // src so the view isn't blanked by retries
  const srcToUse = retryable && attempt > 0 ? `${src}${src.includes('?') ? '&' : '?'}kbRetry=${attempt}` : src
  const recyclingKey = typeof src === 'string' ? src : Array.isArray(src) ? src[0]?.uri : String(src)

  return (
    <>
      <ExpoImage
        source={srcToUse}
        style={style}
        onLoad={_onLoad}
        contentFit={contentFit}
        onError={_onError}
        allowDownscaling={allowDownscaling}
        recyclingKey={recyclingKey}
      />
      {showLoadingStateUntilLoaded && loading ? <LoadingStateView loading={loading} /> : null}
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  absolute: {position: 'absolute'},
}))

export default isMobile ? NativeImage : DesktopImage
