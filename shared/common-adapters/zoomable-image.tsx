import * as Styles from '@/styles'
import * as React from 'react'
import {normalizeFilePathURL} from '@/util/file-url'

type Props = {
  src: string
  style?: Styles.StylesCrossPlatform
  zoomRatio?: number
  onLoaded?: () => void
  onError?: () => void
  onIsZoomed?: (z: boolean) => void
  dragPan?: boolean
  forceDims?: {height: number; width: number}
  onChanged?: (e: {height: number; width: number; x: number; y: number; scale: number}) => void
  onSwipe?: (left: boolean) => void
  onTap?: () => void
  srcDims?: {height: number; width: number}
  boxCacheKey?: string
}
import Toast from './toast'
import Text from './text'
import {View} from 'react-native'
import {useSharedValue} from 'react-native-reanimated'
import {scheduleOnRN} from 'react-native-worklets'
import {fitContainer, ResumableZoom, useImageResolution} from '@/util/zoom-toolkit'
import ImageNative from './image'

// Stub types to avoid DOM lib dependency in native tsconfig
type DivRef = {
  clientHeight: number
  clientWidth: number
  getBoundingClientRect: () => {left: number; top: number; width: number; height: number}
}
type ImgRef = {
  getBoundingClientRect: () => {width: number; height: number}
  naturalHeight: number
  naturalWidth: number
  style: {transform: string}
  classList: {add: (cls: string) => void; remove: (cls: string) => void}
}
type MouseEvt = {clientX: number; clientY: number}
type WheelEvt = MouseEvt & {deltaY: number; cancelable: boolean; preventDefault: () => void}

const DesktopZoomableImage = (p: Props) => {
  const {src, onIsZoomed, onLoaded, dragPan, onChanged, onError, forceDims} = p
  const [isZoomed, setIsZoomed] = React.useState(false)
  const [allowPan, setAllowPan] = React.useState(true)
  const [showToast, setShowToast] = React.useState(false)
  const containerRef = React.useRef<DivRef>(null)
  const imgRef = React.useRef<ImgRef>(null)
  const scaleRef = React.useRef(1)
  // the scale a drag-pan image opens on, the smallest that fills the container: it can't be zoomed
  // out past it, so every crop is a full square of the image
  const coverScaleRef = React.useRef(1)
  const translateRef = React.useRef({x: 0, y: 0})
  const isZoomedRef = React.useRef(isZoomed)

  const toggleZoom = () => {
    const nextIsZoomed = !isZoomed
    isZoomedRef.current = nextIsZoomed
    setIsZoomed(s => !s)
    setShowToast(nextIsZoomed)
    imgRef.current?.classList.remove('fade-anim-enter-active')
    onIsZoomed?.(nextIsZoomed)
  }

  React.useEffect(() => {
    if (!showToast) {
      return undefined
    }
    const id = setTimeout(() => {
      setShowToast(false)
    }, 3000)
    return () => {
      clearTimeout(id)
    }
  }, [showToast])

  const handleMouseMove = (e: MouseEvt) => {
    if (!containerRef.current || !imgRef.current) return
    if (dragPan && !allowPan) return

    imgRef.current.classList.add('fade-anim-enter-active')

    if (!dragPan && !isZoomedRef.current) {
      imgRef.current.style.transform = ''
      return
    }

    // the pointer's place in the container is on screen; the sizes are layout sizes, which an
    // ancestor's transform (a modal scaling in) doesn't skew, at the scale just set
    const bounds = containerRef.current.getBoundingClientRect()
    const xPercent = Math.min(1, Math.max(0, (e.clientX - bounds.left) / bounds.width))
    const yPercent = Math.min(1, Math.max(0, (e.clientY - bounds.top) / bounds.height))
    const containerRect = {height: containerRef.current.clientHeight, width: containerRef.current.clientWidth}
    const imgRect = {
      height: imgRef.current.naturalHeight * scaleRef.current,
      width: imgRef.current.naturalWidth * scaleRef.current,
    }

    const x = Math.min(
      imgRect.width < containerRect.width ? (containerRect.width - imgRect.width) / 2 : 0,
      Math.max(
        -(imgRect.width - containerRect.width),
        containerRect.width * xPercent - imgRect.width * xPercent
      )
    )
    const y = Math.min(
      imgRect.height < containerRect.height ? (containerRect.height - imgRect.height) / 2 : 0,
      Math.max(
        -(imgRect.height - containerRect.height),
        containerRect.height * yPercent - imgRect.height * yPercent
      )
    )

    imgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scaleRef.current})`
    translateRef.current = {x, y}
    onChanged?.({height: imgRect.height, scale: scaleRef.current, width: imgRect.width, x: -x, y: -y})
  }

  // a drag-pan view is a crop, so a loaded image reports the view it opens on before any move. A
  // new image opens filling the container and centered in it, not on the pan and zoom left from the
  // one before. Sizes are read untransformed, so a modal still animating in doesn't skew them.
  const loadedSrcRef = React.useRef<string | undefined>(undefined)
  const handleLoad = () => {
    const img = imgRef.current
    if (img && loadedSrcRef.current !== src) {
      loadedSrcRef.current = src
      const {naturalHeight, naturalWidth} = img
      const cw = containerRef.current?.clientWidth ?? 0
      const ch = containerRef.current?.clientHeight ?? 0
      if (dragPan && naturalWidth && naturalHeight && cw && ch) {
        const cover = Math.max(cw / naturalWidth, ch / naturalHeight)
        const x = (cw - naturalWidth * cover) / 2
        const y = (ch - naturalHeight * cover) / 2
        coverScaleRef.current = cover
        scaleRef.current = cover
        translateRef.current = {x, y}
        img.style.transform = `translate(${x}px, ${y}px) scale(${cover})`
      } else {
        coverScaleRef.current = 1
        scaleRef.current = 1
        translateRef.current = {x: 0, y: 0}
        img.style.transform = ''
      }
    }
    if (dragPan && img) {
      const scale = scaleRef.current
      const {x, y} = translateRef.current
      onChanged?.({height: img.naturalHeight * scale, scale, width: img.naturalWidth * scale, x: -x, y: -y})
    }
    onLoaded?.()
  }

  const handleWheel = (e: WheelEvt) => {
    if (e.cancelable) {
      e.preventDefault()
    }
    if (dragPan && !allowPan) return
    if (!dragPan && !isZoomedRef.current) return

    const delta = e.deltaY > 0 ? 1.02 : 0.98
    const cover = coverScaleRef.current
    const [min, max] = dragPan ? [cover, Math.max(2.5, cover * 2.5)] : [0.3, 2.5]
    scaleRef.current = Math.min(max, Math.max(min, scaleRef.current * delta))
    handleMouseMove(e)
  }

  const handleClick = (e: MouseEvt) => {
    if (dragPan) {
      setAllowPan(prev => !prev)
    } else {
      toggleZoom()
      setTimeout(() => {
        handleMouseMove(e)
      }, 0)
    }
  }

  let style: React.CSSProperties = {
    display: 'flex',
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  }
  let imgStyle: React.CSSProperties = {
    display: 'flex',
    position: 'absolute',
    transformOrigin: '0 0',
  }
  if (dragPan) {
    style = {...style, cursor: allowPan ? 'move' : 'pointer'}
  } else {
    style = {
      ...style,
      cursor: isZoomed ? 'zoom-out' : 'zoom-in',
      ...(isZoomed ? {} : {display: 'flex'}),
    }
    imgStyle = isZoomed
      ? {...imgStyle}
      : {
          ...forceDims,
          margin: 'auto',
          maxHeight: '100%',
          maxWidth: '100%',
          objectFit: 'contain',
        }
  }

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      style={style}
      onMouseMove={handleMouseMove as React.MouseEventHandler}
      onWheel={handleWheel as React.WheelEventHandler}
      onClick={handleClick as React.MouseEventHandler}
    >
      <img
        draggable={false}
        onLoad={handleLoad}
        onError={onError}
        className="fade-anim-enter fade-anim-enter-active"
        ref={imgRef as React.RefObject<HTMLImageElement>}
        src={src ? normalizeFilePathURL(src) : undefined}
        style={imgStyle}
      />
      <Toast visible={showToast} attachTo={containerRef as React.RefObject<never>}>
        <Text type="Body" negative={true}>
          Scroll to zoom. Move to pan
        </Text>
      </Toast>
    </div>
  )
}

type NativeLayoutEvent = {nativeEvent: {layout: {width: number; height: number}}}
type NativeCommonZoomState = {
  scale: number
  childSize: {width: number; height: number}
  containerSize: {width: number; height: number}
  translateX: number
  translateY: number
}
type NativeSwipeDirection = 'left' | 'right' | 'up' | 'down'

const NativeZoomableImage = (p: Props) => {
  const styles = useStyles()
  const {src, style, onChanged: onZoom, onSwipe: _onSwipe, onTap} = p

  const {isFetching, resolution} = useImageResolution({uri: src})
  const srcDims = p.srcDims?.width && p.srcDims.height ? p.srcDims : undefined
  const imageResolution = resolution ?? srcDims
  const imageResolutionHeight = imageResolution?.height
  const imageResolutionWidth = imageResolution?.width
  const currentZoomSV = useSharedValue(1)

  const onUpdate = (s: NativeCommonZoomState) => {
    'worklet'
    currentZoomSV.set(s.scale)
    if (onZoom && imageResolutionWidth) {
      const actualScale = (s.scale * s.childSize.width) / imageResolutionWidth
      const {width} = s.childSize
      const scale = width / imageResolutionWidth
      const scaledContainerWidth = s.containerSize.width / scale
      const scaledContainerHeight = s.containerSize.height / scale

      const left = scaledContainerWidth / 2 - s.translateX - s.containerSize.width / 2
      const top = s.translateY - scaledContainerHeight / 2 + s.containerSize.height / 2
      const z = {
        height: s.childSize.height * s.scale,
        scale: actualScale,
        width: s.childSize.width * s.scale,
        x: left,
        y: top,
      }
      scheduleOnRN(onZoom, z)
    }
  }

  const onSwipe = (dir: NativeSwipeDirection) => {
    if (Math.abs(currentZoomSV.get() - 1) < 0.1) {
      switch (dir) {
        case 'left':
          _onSwipe?.(true)
          break
        case 'right':
          _onSwipe?.(false)
          break
        default:
      }
    }
  }

  const [containerSize, setContainerSize] = React.useState({height: 0, width: 0})
  const onLayout = (event: NativeLayoutEvent) => {
    const {width, height} = event.nativeEvent.layout
    setContainerSize(old => {
      if (old.width === width && old.height === height) return old
      return {height, width}
    })
  }

  let content: React.ReactNode
  if (
    (!imageResolution && isFetching) ||
    !imageResolutionHeight ||
    !imageResolutionWidth ||
    containerSize.width === 0 ||
    containerSize.height === 0
  ) {
    content = <></>
  } else {
    const size = fitContainer(imageResolutionWidth / imageResolutionHeight, containerSize)
    content = (
      <ImageNative
        contentFit="fill"
        src={src}
        style={size}
        showLoadingStateUntilLoaded={false}
        allowDownscaling={false}
      />
    )
  }

  return (
    <View style={Styles.collapseStyles([styles.container, style])} onLayout={onLayout}>
      <ResumableZoom
        maxScale={10}
        extendGestures={true}
        onTap={onTap}
        onUpdate={onUpdate}
        onSwipe={onSwipe}
        panMode="clamp"
      >
        {content}
      </ResumableZoom>
    </View>
  )
}

const ZoomableImage = (p: Props) => {
  if (!isMobile) return <DesktopZoomableImage {...p} />
  return <NativeZoomableImage {...p} />
}

const useStyles = Styles.createStyleHook(
  () =>
    ({
      container: {
        flexGrow: 1,
        overflow: 'hidden',
      },
    }) as const
)

export default ZoomableImage
