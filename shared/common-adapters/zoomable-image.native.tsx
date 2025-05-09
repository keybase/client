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
      if (onZoom && resolution?.width) {
        const actualScale = (s.scale * s.width) / resolution.width
        const {width} = s
        const scale = width / resolution.width
        const scaledContainerWidth = containerSize.width / scale
        const scaledContainerHeight = containerSize.height / scale

        const left = scaledContainerWidth / 2 - s.translateX - containerSize.width / 2
        const top = s.translateY - scaledContainerHeight / 2 + containerSize.height / 2
        const z = {
          height: s.height * s.scale,
          scale: actualScale,
          width: s.width * s.scale,
          x: left,
          y: top,
        }
        runOnJS(onZoom)(z)
      }
    },
    [currentZoomSV, onZoom, resolution, containerSize]
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

  let content: React.ReactNode

  if (isFetching || !resolution) {
    content = <></>
  } else {
    const size = fitContainer(resolution.width / resolution.height, containerSize)
    content = (
      <Image2
        contentFit="fill"
        src={src}
        style={size}
        showLoadingStateUntilLoaded={false}
        allowDownscaling={false}
      />
    )
  }

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
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
