import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import type {Props} from './image2'
import LoadingStateView from './loading-state-view'

const onDragStart = (e: React.BaseSyntheticEvent) => e.preventDefault()
const Image2 = (p: Props) => {
  const {showLoadingStateUntilLoaded, src, onLoad, onError} = p
  const [loading, setLoading] = React.useState(true)
  const isMounted = C.useIsMounted()
  const _onLoad = React.useCallback(
    (e: React.BaseSyntheticEvent) => {
      isMounted() && setLoading(false)
      onLoad?.(e)
    },
    [isMounted, onLoad]
  )
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

const styles = Styles.styleSheetCreate(() => ({
  absolute: {position: 'absolute'},
}))

export default Image2
