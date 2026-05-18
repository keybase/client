import * as React from 'react'
import * as Styles from '@/styles'
import type {ImageLoadEventData, ImageErrorEventData} from 'expo-image'
import type {Props} from './image.shared'
import LoadingStateView from './loading-state-view'

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

type ExpoImageProps = {
  source: Props['src']
  style?: Props['style']
  onLoad?: (e?: ImageLoadEventData) => void
  contentFit?: Props['contentFit']
  onError?: (e?: ImageErrorEventData) => void
  allowDownscaling?: boolean
  recyclingKey?: string
}

const NativeImage = (p: Props) => {
  const {Image: ExpoImage} = require('expo-image') as {Image: React.ComponentType<ExpoImageProps>}
  const {showLoadingStateUntilLoaded, src, onLoad, onError, style, contentFit = 'contain', allowDownscaling} = p
  const [loading, setLoading] = React.useState(!showLoadingStateUntilLoaded)
  const [lastSrc, setLastSrc] = React.useState(src)
  const _onLoad = (e?: ImageLoadEventData) => {
    setLoading(false)
    onLoad?.(e ?? {})
  }

  if (lastSrc !== src) {
    setLastSrc(src)
    setLoading(true)
  }

  const _onError = (e?: ImageErrorEventData) => {
    setLoading(false)
    console.log('Image load error', e?.error)
    onError?.()
  }

  const recyclingKey = typeof src === 'string' ? src : Array.isArray(src) ? src[0]?.uri : String(src)

  return (
    <>
      <ExpoImage
        source={src}
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
