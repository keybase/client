import * as React from 'react'
import * as Styles from '@/styles'
import {ZoomableBox} from './zoomable-box'
import Image2 from './image2.native'
import type {Props} from './zoomable-image'
import ProgressIndicator from './progress-indicator.native'
import {Box2} from './box'

const Kb = {
  Box2,
  Image2,
  ProgressIndicator,
  ZoomableBox,
}

const dummySize = {height: 1, width: 1}

const ZoomableImage = (p: Props) => {
  const {src, style, onChanged, onLoaded, onSwipe, onTap, onError} = p
  const onZoom = onChanged
  const [loading, setLoading] = React.useState(true)
  const [lastSrc, setLastSrc] = React.useState(src)
  const [size, setSize] = React.useState<undefined | {width: number; height: number}>(undefined)
  const onLoad = React.useCallback(
    (e: {source?: {width: number; height: number}}) => {
      if (!e.source) return
      setLoading(false)
      setSize(e.source)
      onLoaded?.()
    },
    [onLoaded]
  )

  if (lastSrc !== src) {
    setLastSrc(src)
    setLoading(true)
  }

  const imageSize = React.useMemo(
    () =>
      size
        ? {
            height: size.height,
            width: size.width,
          }
        : undefined,
    [size]
  )
  const measuredStyle = size ? imageSize : dummySize

  return (
    <Kb.ZoomableBox
      onSwipe={onSwipe}
      style={style}
      maxZoom={10}
      minZoom={0.01}
      contentContainerStyle={measuredStyle}
      onZoom={onZoom}
      onTap={onTap}
    >
      <Kb.Image2
        contentFit="none"
        src={src}
        style={measuredStyle}
        onLoad={onLoad}
        onError={onError}
        showLoadingStateUntilLoaded={false}
        allowDownscaling={false}
      />
      {loading ? (
        <Kb.Box2 direction="vertical" style={styles.progress}>
          <Kb.ProgressIndicator white={true} />
        </Kb.Box2>
      ) : null}
    </Kb.ZoomableBox>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      contentContainerStyle: {
        alignContent: 'center',
        height: '100%',
        justifyContent: 'center',
        maxHeight: '100%',
        maxWidth: '100%',
        width: '100%',
      },
      imageAndroid: {flexGrow: 1},
      progress: {
        left: '50%',
        position: 'absolute',
        top: '50%',
      },
      zoomableBoxContainerAndroid: {
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      },
    }) as const
)

export default ZoomableImage
