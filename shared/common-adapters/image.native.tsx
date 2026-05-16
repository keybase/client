import type {StylesCrossPlatform} from '@/styles'
import * as React from 'react'
import LoadingStateView from '@/common-adapters/loading-state-view'
import {Image as ExpoImage, type ImageLoadEventData, type ImageErrorEventData} from 'expo-image'


type Props = {
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  src: number | string | Array<{uri: string; width: number; height: number}>
  style?: StylesCrossPlatform
  showLoadingStateUntilLoaded?: boolean
  onLoad?: (e: {target?: unknown; source?: {width: number; height: number}}) => void
  onError?: () => void
  allowDownscaling?: boolean
}
const Image = (p: Props) => {
  const {showLoadingStateUntilLoaded, src, onLoad, onError, style, contentFit = 'contain', allowDownscaling} = p
  const [loading, setLoading] = React.useState(!showLoadingStateUntilLoaded)
  const [lastSrc, setLastSrc] = React.useState(src)
  const _onLoad = (e?: ImageLoadEventData) => {
    setLoading(false)
    onLoad?.(e ?? ({} as any))
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

export default Image
