import type {Props} from './zoomable-image'
import * as Styles from '@/styles'
import * as React from 'react'
import Image2 from './image2.native'
import {View, type LayoutChangeEvent} from 'react-native'
import {useSharedValue, runOnJS} from 'react-native-reanimated'
import {
  fitContainer,
  ResumableZoom,
  useImageResolution,
  type CommonZoomState,
  type SwipeDirection,
} from 'react-native-zoom-toolkit'

const ZoomableImage = React.memo(function (p: Props) {
  const {src, style, onChanged: onZoom, onSwipe: _onSwipe, onTap} = p
  const {isFetching, resolution} = useImageResolution({uri: src})
  const [containerSize, setContainerSize] = React.useState({height: 0, width: 0})
  const currentZoomSV = useSharedValue(1)

  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout
    setContainerSize(old => {
      if (old.width === width && old.height === height) {
        return old
      }
      return {height, width}
    })
  }, [])

  const onUpdate = React.useCallback(
    (s: CommonZoomState<number>) => {
      'worklet'
      currentZoomSV.set(s.scale)
      if (onZoom) {
        const z = {
          height: s.height,
          scale: s.scale,
          width: s.width,
          x: 0, //s.width / 2 + s.translateX,
          y: 0, //s.height / 2 + s.translateY,
        }
        runOnJS(onZoom)(z)
      }
    },
    [currentZoomSV, onZoom]
  )

  const onSwipe = React.useCallback(
    (dir: SwipeDirection) => {
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
    },
    [_onSwipe, currentZoomSV]
  )

  if (isFetching || !resolution) {
    return null
  }

  const size = fitContainer(resolution.width / resolution.height, containerSize)

  return (
    <View style={[styles.container, style]} onLayout={onLayout} key={src}>
      {containerSize.width ? (
        <ResumableZoom
          maxScale={10}
          extendGestures={true}
          onTap={onTap}
          onUpdate={onUpdate}
          onSwipe={onSwipe}
          panMode="clamp"
        >
          <Image2
            contentFit="fill"
            src={src}
            style={size}
            showLoadingStateUntilLoaded={false}
            allowDownscaling={false}
          />
        </ResumableZoom>
      ) : null}
    </View>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        flexGrow: 1,
        overflow: 'hidden',
      },
    }) as const
)

export default ZoomableImage
