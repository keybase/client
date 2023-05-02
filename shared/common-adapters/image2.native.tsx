import * as React from 'react'
import LoadingStateView from './loading-state-view'
import type {Props} from './image2'
import {Image} from 'expo-image'

const Image2 = (p: Props) => {
  const {showLoadingStateUntilLoaded = true, src, onLoad, onError, style} = p
  const [loading, setLoading] = React.useState(true)
  const _onLoad = React.useCallback(
    (e: any) => {
      setLoading(false)
      onLoad?.(e)
    },
    [onLoad]
  )

  return (
    <>
      <Image
        source={src}
        style={style as any}
        onLoad={_onLoad}
        cachePolicy="memory"
        contentFit="contain"
        onError={onError}
      />
      {showLoadingStateUntilLoaded && loading ? <LoadingStateView loading={loading} /> : null}
    </>
  )
}

export default Image2
