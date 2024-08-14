import * as React from 'react'
import * as Styles from '@/styles'
import {type LayoutChangeEvent} from 'react-native'
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
  const [boxW, setBoxW] = React.useState(0)
  const [boxH, setBoxH] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [lastSrc, setLastSrc] = React.useState(src)
  const [size, setSize] = React.useState<undefined | {width: number; height: number}>(undefined)
  const [scale, setScale] = React.useState(1)

  const onZoom = onChanged

  const onLayout = React.useCallback((e: Partial<LayoutChangeEvent>) => {
    if (!e.nativeEvent) return
    const {width, height} = e.nativeEvent.layout
    setBoxW(width)
    setBoxH(height)
  }, [])

  const onLoad = React.useCallback(
    (e: {source?: {width: number; height: number}}) => {
      if (!e.source) {
        return
      }
      setSize(e.source)
      onLoaded?.()
    },
    [onLoaded]
  )

  const initialZoomRef = React.useRef(false)
  React.useEffect(() => {
    if (initialZoomRef.current || !size || !boxW || !boxH) {
      return
    }
    initialZoomRef.current = true
    const sizeRatio = size.width / size.height
    const boxRatio = boxW / boxH
    const zoom = sizeRatio > boxRatio ? boxW / size.width : boxH / size.height

    // if zoom is the same we still calc this
    setScale(zoom + 0.1)
    setTimeout(() => {
      setScale(zoom)
      setTimeout(() => {
        setLoading(false)
      }, 10)
    }, 0)
  }, [boxW, boxH, size])

  if (lastSrc !== src) {
    setLastSrc(src)
    setLoading(true)
    initialZoomRef.current = false
  }

  const imageSize = React.useMemo(
    () =>
      size
        ? Styles.isAndroid
          ? {
              backgroundColor: Styles.globalColors.black,
              height: size.height,
              opacity: loading ? 0 : 1,
              position: 'relative',
              width: size.width,
            }
          : {
              height: size.height,
              opacity: loading ? 0 : 1,
              width: size.width,
            }
        : undefined,
    [size, loading]
  )
  const measuredStyle = size ? imageSize : dummySize

  const content = (
    <>
      {src ? (
        <Kb.Image2
          contentFit="cover"
          src={src}
          style={measuredStyle}
          onLoad={onLoad}
          onError={onError}
          showLoadingStateUntilLoaded={false}
          allowDownscaling={false}
        />
      ) : null}
      {loading ? (
        <Kb.Box2 direction="vertical" style={styles.progress}>
          <Kb.ProgressIndicator white={true} />
        </Kb.Box2>
      ) : null}
    </>
  )

  return (
    <Kb.ZoomableBox
      key={src + String(scale)}
      onSwipe={onSwipe}
      onLayout={onLayout}
      style={style}
      maxZoom={10}
      minZoom={0.01}
      contentContainerStyle={measuredStyle}
      onZoom={onZoom}
      onTap={onTap}
      zoomScale={scale}
      contentSize={size}
    >
      {content}
    </Kb.ZoomableBox>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      progress: {
        left: '50%',
        position: 'absolute',
        top: '50%',
      },
    }) as const
)

export default ZoomableImage
