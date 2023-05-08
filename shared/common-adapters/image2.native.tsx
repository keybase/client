import * as React from 'react'
import LoadingStateView from './loading-state-view'
import type {Props} from './image2'
import {Image} from 'expo-image'

const Image2 = (p: Props) => {
  console.log('aaa image2', p)
  const {showLoadingStateUntilLoaded = true, src, onLoad, /*onError, */ style} = p
  const [loading, setLoading] = React.useState(true)
  const _onLoad = React.useCallback(
    (e: any) => {
      console.log('aaa onloaded', e)
      setLoading(false)
      onLoad?.(e)
    },
    [onLoad]
  )

  const onError = e => {
    console.log('aaa onerror', e)
  }

  return (
    <>
      <Image
        source={src}
        style={
          // eslint-disable-next-line
          style as any
          // {width: 200, height: 200, backgroundColor: 'red'}
        }
        onLoad={_onLoad}
        cachePolicy="none"
        contentFit="contain"
        onError={onError}
      />
      {showLoadingStateUntilLoaded && loading ? <LoadingStateView loading={loading} /> : null}
    </>
  )
}

export default Image2
