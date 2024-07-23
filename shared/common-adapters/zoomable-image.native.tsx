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
const DUMMY = false as boolean

const ZoomableImage = (p: Props) => {
  const {src, style: _style, onChanged, onLoaded, onSwipe, onTap, onError} = p
  // console.log('aaaa zoomimage natie', p)
  // const onZoom = onChanged
  const [boxW, setBoxW] = React.useState(0)
  const [boxH, setBoxH] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [lastSrc, setLastSrc] = React.useState(src)
  // const [key, setKey] = React.useState(0)
  const [size, setSize] = React.useState<undefined | {width: number; height: number}>(
    DUMMY ? {width: 200, height: 200} : undefined
  )
  const [scale, setScale] = React.useState(1)

  React.useEffect(() => {
    console.log('aaaa MOUNTED')
    return () => {
      console.log('aaaa unMOUNTED')
    }
  }, [])

  const onZoom = (a: any) => {
    // console.log('aaa onzoom', a)
    onChanged?.(a)
  }

  const onLayout = React.useCallback((e: Partial<LayoutChangeEvent>) => {
    if (!e.nativeEvent) return
    const {width, height} = e.nativeEvent.layout
    setBoxW(width)
    setBoxH(height)
  }, [])

  const onLoad = React.useCallback(
    (e: {source?: {width: number; height: number}}) => {
      // console.log('aaaa onload <<<<<', e)
      if (!e.source) {
        // console.log('aaaa onload set size bail', e)
        return
      }
      // console.log('aaaa onload set size', e.source)
      setSize(e.source)
      // console.log('aaaa onload after set size', e.source)
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

    // should be 0.34
    // console.log('aaa >>>>>>>>>>>>>calczoom', {size, boxW, boxH, sizeRatio, boxRatio, zoom})

    setScale(zoom + 0.1)
    setTimeout(() => {
      setScale(zoom)
      setLoading(false)
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
              opacity: loading ? 0 : 1,
              backgroundColor: Styles.globalColors.black,
              position: 'relative',
              // height: '100%',
              // maxHeight: '100%',
              // maxWidth: '100%',
              // width: '100%',
              height: size.height,
              width: size.width,
            }
          : {
              height: size.height,
              width: size.width,
            }
        : undefined,
    [size, loading]
  )
  const measuredStyle = size ? imageSize : dummySize

  const style = Styles.isAndroid
    ? {
        ..._style,
        // maxHeight: '100%',
        // maxWidth: '100%',
      }
    : _style

  // console.log('aaa render zoomaimbe', {style, measuredStyle})
  // const lastSrcRef = React.useRef('')
  // if (lastSrcRef.current !== src) {
  //   lastSrcRef.current = src
  //   setTimeout(() => {
  //     setKey(s => s + 1)
  //   }, 1000)
  // }
  // React.useEffect(() => {
  //   console.log('aaaa >>>>>>>>> useeffect setkey')
  //   setKey(s => s + 1)
  // }, [src])

  const content = DUMMY ? (
    <Kb.Box2
      direction="vertical"
      style={{position: 'relative', backgroundColor: 'pink', width: 200, height: 200}}
    >
      <Kb.Box2
        direction="vertical"
        style={{backgroundColor: 'green', width: 100, height: 100, position: 'absolute', left: 0, top: 0}}
      />
      <Kb.Box2
        direction="vertical"
        style={{
          backgroundColor: 'red   ',
          width: 100,
          height: 100,
          position: 'absolute',
          left: 0,
          bottom: 0,
        }}
      />
      <Kb.Box2
        direction="vertical"
        style={{backgroundColor: 'blue', width: 100, height: 100, position: 'absolute', right: 0, top: 0}}
      />
    </Kb.Box2>
  ) : (
    <>
      <Kb.Image2
        contentFit="cover"
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
    </>
  )
  // console.log('aaa render with key', src)
  return (
    <Kb.ZoomableBox
      key={src}
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
