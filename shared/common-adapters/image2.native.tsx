import * as React from 'react'
import LoadingStateView from './loading-state-view'
import type {Props} from './image2'
import {Image, type ImageLoadEventData} from 'expo-image'

const Image2 = (p: Props) => {
  const {
    showLoadingStateUntilLoaded,
    src,
    onLoad,
    onError,
    style,
    contentFit = 'contain',
    allowDownscaling,
  } = p
  // if we don't have showLoadingStateUntilLoaded then just mark as loaded and ignore this state
  const [loading, setLoading] = React.useState(!showLoadingStateUntilLoaded)
  const [lastSrc, setLastSrc] = React.useState(src)
  const _onLoad = React.useCallback(
    (e: ImageLoadEventData) => {
      setLoading(false)
      onLoad?.(e)
    },
    [onLoad]
  )

  if (lastSrc !== src) {
    setLastSrc(src)
    setLoading(true)
  }

  const _onError = React.useCallback(
    (e: unknown) => {
      setLoading(false)
      console.log('Image2 load error', e)
      onError?.()
    },
    [setLoading, onError]
  )

  return (
    <>
      <Image
        source={src}
        style={style}
        onLoad={_onLoad}
        contentFit={contentFit}
        onError={_onError}
        allowDownscaling={allowDownscaling}
      />
      {showLoadingStateUntilLoaded && loading ? <LoadingStateView loading={loading} /> : null}
    </>
  )
}

export default Image2
