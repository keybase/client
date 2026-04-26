import * as React from 'react'
import LoadingStateView from './loading-state-view'
import type {Props} from './image'
import {Image as ExpoImage, type ImageLoadEventData, type ImageErrorEventData} from 'expo-image'

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
        {...(recyclingKey === undefined ? {} : {recyclingKey})}
        {...(allowDownscaling === undefined ? {} : {allowDownscaling})}
      />
      {showLoadingStateUntilLoaded && loading ? <LoadingStateView loading={loading} /> : null}
    </>
  )
}

export default Image
