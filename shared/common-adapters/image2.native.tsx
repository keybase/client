import * as React from 'react'
import LoadingStateView from './loading-state-view'
import type {Props} from './image2'
import {Image} from 'expo-image'

const Image2 = (p: Props) => {
  const {showLoadingStateUntilLoaded, src, onLoad, onError, style, contentFit = 'contain'} = p
  // if we don't have showLoadingStateUntilLoaded then just mark as loaded and ignore this state
  const [loading, setLoading] = React.useState(showLoadingStateUntilLoaded ? false : true)
  const _onLoad = React.useCallback(
    (e: any) => {
      setLoading(false)
      onLoad?.(e)
    },
    [onLoad]
  )

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
        style={
          // eslint-disable-next-line
          style as any
        }
        onLoad={_onLoad}
        contentFit={contentFit}
        onError={_onError}
      />
      {showLoadingStateUntilLoaded && loading ? <LoadingStateView loading={loading} /> : null}
    </>
  )
}

export default Image2
