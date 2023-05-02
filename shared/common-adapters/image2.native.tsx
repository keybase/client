import * as Container from '../util/container'
import * as React from 'react'
import * as Styles from '../styles'
import LoadingStateView from './loading-state-view'
import type {Props} from './image'
import {Image /*, type ImageProgressEventData*/} from 'expo-image'

const Image2 = (p: Props) => {
  const {showLoadingStateUntilLoaded, src} = p
  const [loading, setLoading] = React.useState(true)
  const isMounted = Container.useIsMounted()
  const onLoad = React.useCallback(() => {
    isMounted() && setLoading(false)
  }, [isMounted])
  const style = {
    ...p.style,
    ...(showLoadingStateUntilLoaded && loading ? styles.absolute : {}),
    opacity: showLoadingStateUntilLoaded && loading ? 0 : 1,
  }

  // onDragStart={props.onDragStart}
  // draggable={props.draggable}
  // onError={props.onError}
  return (
    <>
      <Image source={src} style={style} onLoad={onLoad} cachePolicy="memory" contentFit="contain" />
      {showLoadingStateUntilLoaded ? <LoadingStateView loading={loading} /> : null}
    </>
  )
}

export default Image2

const styles = Styles.styleSheetCreate(() => ({
  absolute: {
    position: 'absolute',
  },
}))
