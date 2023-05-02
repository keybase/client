import * as React from 'react'
import * as Styles from '../styles'
import * as Container from '../util/container'
import type {Props} from './image'
import LoadingStateView from './loading-state-view'

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

  return (
    <>
      <img src={src} style={style} onLoad={onLoad} />
      {showLoadingStateUntilLoaded ? <LoadingStateView loading={loading} /> : null}
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  absolute: {
    position: 'absolute',
  },
}))

export default Image2
