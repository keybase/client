import * as React from 'react'
import * as Styles from '../styles'
import {ZoomableBox} from './zoomable-box'
import Image2 from './image2.native'
import type {Props} from './zoomable-image'
import {type LayoutChangeEvent} from 'react-native'
import ProgressIndicator from './progress-indicator.native'
import {Box2} from './box'

const Kb = {
  Box2,
  Image2,
  ProgressIndicator,
  ZoomableBox,
}

const ZoomableImage = (p: Props) => {
  const {src, style, onChanged, onLoaded, onSwipe} = p
  const onZoom = onChanged
  const [boxW, setBoxW] = React.useState(0)
  const [boxH, setBoxH] = React.useState(0)
  // const [imgW, setImgW] = React.useState(0)
  // const [imgH, setImgH] = React.useState(0)
  // const [zoomScale, setZoomScale] = React.useState(0)

  // const updateZoomScale = React.useCallback(() => {
  //   if (zoomScale === 0 && boxW !== 0 && boxH !== 0 && imgW !== 0 && imgH !== 0) {
  //     console.log('aaa updating zoomscale', {
  //       boxW,
  //       boxH,
  //       imgW,
  //       imgH,
  //       scale: Math.min(boxW / imgW, boxH / imgH),
  //     })
  //     setZoomScale(Math.min(boxW / imgW, boxH / imgH))
  //   }
  // }, [boxW, boxH, imgH, imgW, zoomScale])
  //
  const onLoad = React.useCallback(
    (e: {source?: {width: number; height: number}}) => {
      if (!e.source) return
      onLoaded?.()
      // const {height, width} = e.source
      // setImgW(width)
      // setImgH(height)
      // updateZoomScale()
    },
    [onLoaded /*, updateZoomScale*/]
  )

  const boxOnLayout = React.useCallback(
    (e: Partial<LayoutChangeEvent>) => {
      if (!e.nativeEvent) return
      const {width, height} = e.nativeEvent.layout
      setBoxW(width)
      setBoxH(height)
      // updateZoomScale()
    },
    [
      /*updateZoomScale*/
    ]
  )

  // in order for the images to not get downscaled we have to make it larger and then transform it
  const manualScale = 5
  return (
    <Kb.ZoomableBox
      onLayout={boxOnLayout}
      onSwipe={onSwipe}
      style={style}
      contentContainerStyle={styles.contentContainerStyle}
      onZoom={onZoom}
    >
      <Kb.Box2
        direction="vertical"
        style={{
          height: boxH * manualScale,
          transform: [{scaleX: 1 / manualScale}, {scaleY: 1 / manualScale}],
          width: boxW * manualScale,
        }}
      >
        <Kb.Image2
          contentFit="contain"
          src={src}
          style={styles.image}
          onLoad={onLoad}
          showLoadingStateUntilLoaded={true}
        />
        {/*show ? null : (
          <Kb.Box2 direction="vertical" style={styles.progress}>
            <Kb.ProgressIndicator white={true} />
          </Kb.Box2>
        )*/}
      </Kb.Box2>
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
      image: {
        height: '100%',
        width: '100%',
      },
      progress: {
        position: 'absolute',
        top: 0,
      },
      zoomableBoxContainerAndroid: {
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      },
    }) as const
)

export default ZoomableImage
