import * as React from 'react'
import * as Styles from '../styles'
import * as Container from '../util/container'
import type {Props, ReqProps} from './image'
import LoadingStateView from './loading-state-view'

const RequireImage = React.forwardRef<any, ReqProps>(({src, style}: ReqProps, ref: any) => (
  <img ref={ref} src={src} style={style as any} />
))
const Image = React.forwardRef<any, Props>(function Image(props: Props, ref: any) {
  const [loading, setLoading] = React.useState(true)
  const isMounted = Container.useIsMounted()
  const style = {
    ...props.style,
    ...(props.showLoadingStateUntilLoaded && loading ? styles.absolute : {}),
    opacity: props.showLoadingStateUntilLoaded && loading ? 0 : 1,
  }

  return (
    <>
      <img
        ref={ref}
        src={props.src}
        style={style}
        onDragStart={props.onDragStart}
        draggable={props.draggable}
        onLoad={evt => {
          isMounted() && setLoading(false)
          props.onLoad?.(evt)
        }}
        onError={props.onError}
      />
      {props.showLoadingStateUntilLoaded ? <LoadingStateView loading={loading} /> : null}
    </>
  )
})

export default Image
export {RequireImage}

const styles = Styles.styleSheetCreate(() => ({
  absolute: {
    position: 'absolute',
  },
}))
