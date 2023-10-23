import * as React from 'react'
import * as Styles from '../styles'
import {ZoomableBox} from './zoomable-box'
import Image2 from './image2.native'
import type {Props} from './zoomable-image'
import type {LayoutChangeEvent} from 'react-native'

const Kb = {
  Image2,
  ZoomableBox,
}

const ZoomableImage = (p: Props) => {
  const {src, style, onChanged, onLoaded} = p
  const onZoom = onChanged
  const [boxW, setBoxW] = React.useState(0)
  const [boxH, setBoxH] = React.useState(0)
  const [imgW, setImgW] = React.useState(0)
  const [imgH, setImgH] = React.useState(0)
  const [zoomScale, setZoomScale] = React.useState(0)

  const updateZoomScale = React.useCallback(() => {
    if (zoomScale === 0 && boxW !== 0 && boxH !== 0 && imgW !== 0 && imgH !== 0) {
      setZoomScale(Math.min(boxW / imgW, boxH / imgH))
    }
  }, [boxW, boxH, imgH, imgW, zoomScale])

  const onLoad = React.useCallback(
    (e: {source?: {width: number; height: number}}) => {
      if (!e.source) return
      onLoaded?.()
      const {height, width} = e.source
      setImgW(width)
      setImgH(height)
      updateZoomScale()
    },
    [onLoaded, updateZoomScale]
  )

  const boxOnLayout = React.useCallback(
    (e: Partial<LayoutChangeEvent>) => {
      if (!e.nativeEvent) return
      const {width, height} = e.nativeEvent.layout
      setBoxW(width)
      setBoxH(height)
      updateZoomScale()
    },
    [updateZoomScale]
  )

  return (
    <Kb.ZoomableBox
      onLayout={boxOnLayout}
      style={style}
      contentContainerStyle={
        Styles.isIOS
          ? {
              alignItems: 'center',
              height: imgH === 0 ? 1 : imgH + 0,
              justifyContent: 'center',
              opacity: imgW === 0 ? 0 : 1,
              width: imgW === 0 ? 1 : imgW + 0,
            }
          : styles.zoomableBoxContainerAndroid
      }
      onZoom={onZoom}
      minZoom={zoomScale}
      zoomScale={zoomScale}
    >
      <Kb.Image2
        contentFit="none"
        src={src}
        style={
          Styles.isIOS ? {height: imgH === 0 ? 10 : imgH, width: imgW === 0 ? 10 : imgW} : styles.imageAndroid
        }
        onLoad={onLoad}
        showLoadingStateUntilLoaded={true}
      />
    </Kb.ZoomableBox>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      imageAndroid: {flexGrow: 1},
      zoomableBoxContainerAndroid: {
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      },
    }) as const
)

export default ZoomableImage
