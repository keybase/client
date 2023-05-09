import * as React from 'react'
import LoadingStateView from './loading-state-view'
import type {Props} from './image2'
import {Image} from 'expo-image'

const Image2 = (p: Props) => {
  const {showLoadingStateUntilLoaded, src, onLoad, onError, style} = p
  const [loading, setLoading] = React.useState(true)
  const _onLoad = React.useCallback(
    (e: any) => {
      setLoading(false)
      onLoad?.(e)
    },
    [onLoad]
  )

  const _onError = (e: unknown) => {
    setLoading(false)
    console.log('Image2 load error', e)
    onError?.()
  }

  return (
    <>
      <Image
        source={src}
        style={
          // eslint-disable-next-line
          style as any
        }
        onLoad={_onLoad}
        contentFit="contain"
        onError={_onError}
      />
      {showLoadingStateUntilLoaded && loading ? <LoadingStateView loading={loading} /> : null}
    </>
  )
}

export default Image2
