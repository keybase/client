import * as React from 'react'
import * as Styles from '@/styles'
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
  const {src, style, onChanged, onLoaded, onSwipe, onTap, onError} = p
  const onZoom = onChanged
  const [boxW, setBoxW] = React.useState(0)
  const [boxH, setBoxH] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [lastSrc, setLastSrc] = React.useState(src)
  const onLoad = React.useCallback(
    (e: {source?: {width: number; height: number}}) => {
      if (!e.source) return
      setLoading(false)
      onLoaded?.()
    },
    [onLoaded]
  )

  if (lastSrc !== src) {
    setLastSrc(src)
    setLoading(true)
  }

  const boxOnLayout = React.useCallback((e: Partial<LayoutChangeEvent>) => {
    if (!e.nativeEvent) return
    const {width, height} = e.nativeEvent.layout
    setBoxW(width)
    setBoxH(height)
  }, [])

  // in order for the images to not get downscaled we have to make it larger and then transform it
  const manualScale = 5

  return (
    <Kb.ZoomableBox
      onLayout={boxOnLayout}
      onSwipe={onSwipe}
      style={style}
      contentContainerStyle={styles.contentContainerStyle}
      onZoom={onZoom}
      onTap={onTap}
    >
      <Kb.Box2
        direction="vertical"
        style={Styles.platformStyles({
          isMobile: {
            height: boxH * manualScale,
            transform: [{scaleX: 1 / manualScale}, {scaleY: 1 / manualScale}],
            width: boxW * manualScale,
          },
        })}
      >
        <Kb.Image2
          contentFit="contain"
          src={src}
          style={styles.image}
          onLoad={onLoad}
          onError={onError}
          showLoadingStateUntilLoaded={false}
        />
      </Kb.Box2>
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
      image: {
        height: '100%',
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
