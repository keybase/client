import * as React from 'react'
import * as Styles from '../styles'
import * as Container from '../util/container'
import type {Props} from './image2'
import LoadingStateView from './loading-state-view'

const onDragStart = e => e.preventDefault()
// TODO only reason this is a ref is for edit profile, which shouldn't likely use it at all
const Image2 = React.forwardRef<Props, any>(function Image2(p: Props, ref: any) {
  const {showLoadingStateUntilLoaded, src, onLoad, onError} = p
  const [loading, setLoading] = React.useState(true)
  const isMounted = Container.useIsMounted()
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
  }

  return (
    <>
      <img
        ref={ref}
        src={
          // eslint-disable-next-line
          src as any
        }
        style={style}
        onLoad={_onLoad}
        onError={onError}
        onDragStart={onDragStart}
      />
      {showLoadingStateUntilLoaded ? <LoadingStateView loading={loading} /> : null}
    </>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  absolute: {
    position: 'absolute',
  },
}))

export default Image2
