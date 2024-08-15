import * as React from 'react'
import * as Styles from '@/styles'
import {type LayoutChangeEvent} from 'react-native'
import {ZoomableBox} from './zoomable-box'
import Image2 from './image2.native'
import type {Props} from './zoomable-image'
import ProgressIndicator from './progress-indicator.native'
import {Box2} from './box'
import isEqual from 'lodash/isEqual'

const Kb = {
  Box2,
  Image2,
  ProgressIndicator,
  ZoomableBox,
}

const dummySize = {height: 1, width: 1}

// per context cache the size
const boxContextCache = new Map<string, {height: number; width: number}>()

const getScale = (width: number, height: number, containerWidth: number, containerHeight: number) => {
  const sizeRatio = width / height
  const boxRatio = containerWidth / containerHeight
  return sizeRatio > boxRatio ? containerWidth / width : containerHeight / height
}

const ZoomableImage = React.memo(function (p: Props) {
  const {src, style, onChanged, onLoaded, onSwipe, onTap, onError, boxCacheKey = ''} = p
  const [boxW, setBoxW] = React.useState(boxContextCache.get(boxCacheKey)?.width ?? 0)
  const [boxH, setBoxH] = React.useState(boxContextCache.get(boxCacheKey)?.height ?? 0)
  const [loading, setLoading] = React.useState(true)
  const [lastSrc, setLastSrc] = React.useState(src)
  const [size, setSize] = React.useState<undefined | {width: number; height: number}>(p.srcDims)
  const [scale, setScale] = React.useState(
    size && boxW && boxH ? getScale(size.width, size.height, boxW, boxH) : 1
  )

  const onZoom = onChanged

  const onLayout = React.useCallback(
    (e: Partial<LayoutChangeEvent>) => {
      if (!e.nativeEvent) return
      const {width, height} = e.nativeEvent.layout
      // rotate?
      if (boxW && boxW !== width) {
        initialZoomRef.current = false
      }
      setBoxW(width)
      setBoxH(height)
      if (boxCacheKey) {
        boxContextCache.set(boxCacheKey, {height, width})
      }
    },
    [boxCacheKey, boxW]
  )

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

  const initialZoomRef = React.useRef(!!size && !!boxW && !!boxH)
  React.useEffect(() => {
    if (initialZoomRef.current || !size || !boxW || !boxH) {
      return
    }
    initialZoomRef.current = true
    const s = getScale(size.width, size.height, boxW, boxH)
    setScale(s)
    setLoading(false)
  }, [boxW, boxH, size])

  if (lastSrc !== src) {
    setLastSrc(src)
    setLoading(true)
    initialZoomRef.current = false
  }

  const imageSizeCacheRef = React.useRef(new Map<string, Styles.StylesCrossPlatform>())
  const imageSize = React.useMemo(() => {
    const style = size
      ? Styles.isAndroid
        ? ({
            backgroundColor: Styles.globalColors.black,
            height: size.height,
            position: 'relative',
            width: size.width,
          } as const)
        : ({
            height: size.height,
            width: size.width,
          } as const)
      : undefined

    const old = imageSizeCacheRef.current.get(src)
    if (isEqual(style, old)) {
      return old
    }
    imageSizeCacheRef.current.set(src, style)
    return style
  }, [src, size])
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
      key={Styles.isAndroid ? src : src + String(scale)}
      onSwipe={onSwipe}
      onLayout={onLayout}
      style={style}
      maxZoom={10}
      minZoom={scale}
      contentContainerStyle={measuredStyle}
      onZoom={onZoom}
      onTap={onTap}
      zoomScale={scale}
      contentSize={size}
    >
      {content}
    </Kb.ZoomableBox>
  )
})

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
