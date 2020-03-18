import * as React from 'react'
import * as Styles from '../styles'
import {Props, ReqProps} from './image'
import LoadingStateView from './loading-state-view'
import Animated from './animated'

// @ts-ignore clash between StylesCrossPlatform and React.CSSProperties
const RequireImage = ({src, style}: ReqProps) => <img src={src} style={style} />
const Image = (props: Props) => {
  const [loading, setLoading] = React.useState(true)
  const isMounted = React.useRef<Boolean>(true)
  React.useEffect(
    () => () => {
      isMounted.current = false
    },
    []
  )
  return (
    <>
      <Animated to={{opacity: props.showLoadingStateUntilLoaded && loading ? 0 : 1}}>
        {({opacity}) => (
          <img
            src={props.src}
            style={Styles.collapseStyles([
              props.style,
              props.showLoadingStateUntilLoaded && loading && styles.absolute,
              {opacity},
            ])}
            onDragStart={props.onDragStart}
            draggable={props.draggable}
            onLoad={evt => {
              isMounted.current && setLoading(false)
              props.onLoad && props.onLoad(evt)
            }}
            onError={props.onError}
          />
        )}
      </Animated>
      {props.showLoadingStateUntilLoaded ? <LoadingStateView loading={loading} /> : null}
    </>
  )
}

export default Image
export {RequireImage}

const styles = Styles.styleSheetCreate(() => ({
  absolute: {
    position: 'absolute',
  },
}))
