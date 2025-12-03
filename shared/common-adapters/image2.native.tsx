import * as React from 'react'
import LoadingStateView from './loading-state-view'
import type {Props} from './image2'
import {Image, type ImageLoadEventData, type ImageErrorEventData} from 'expo-image'
import logger from '@/logger'

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
      logger.info('[Image2] Load SUCCESS:', {
        src: typeof src === 'string' ? src.substring(0, 80) + '...' : 'non-string',
      })
      onLoad?.(e)
    },
    [onLoad, src]
  )

  if (lastSrc !== src) {
    setLastSrc(src)
    setLoading(true)
    logger.info('[Image2] Src changed, reloading:', {
      oldSrc: typeof lastSrc === 'string' ? lastSrc.substring(0, 80) + '...' : 'non-string',
      newSrc: typeof src === 'string' ? src.substring(0, 80) + '...' : 'non-string',
    })
  }

  const _onError = React.useCallback(
    (e: ImageErrorEventData) => {
      setLoading(false)
      logger.info('[Image2] Load ERROR:', {
        error: e.error,
        src: typeof src === 'string' ? src.substring(0, 80) + '...' : 'non-string',
      })
      onError?.()
    },
    [setLoading, onError, src]
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
