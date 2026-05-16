import * as React from 'react'
import * as Styles from '@/styles'
import LoadingStateView from '@/common-adapters/loading-state-view'


type Props = {
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  src: number | string | Array<{uri: string; width: number; height: number}>
  style?: Styles.StylesCrossPlatform
  showLoadingStateUntilLoaded?: boolean
  onLoad?: (e: {target?: unknown; source?: {width: number; height: number}}) => void
  onError?: () => void
  allowDownscaling?: boolean
}
const onDragStart = (e: React.BaseSyntheticEvent) => e.preventDefault()
const Image = (p: Props) => {
  const {showLoadingStateUntilLoaded, src, onLoad, onError} = p
  const [loading, setLoading] = React.useState(true)
  const _onLoad = (e: React.BaseSyntheticEvent) => {
    setLoading(false)
    onLoad?.(e)
  }
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

export default Image
