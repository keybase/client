import * as React from 'react'
import {StyleSheet, View, type LayoutChangeEvent, type ViewStyle} from 'react-native'
import Animated, {useAnimatedStyle, useDerivedValue, useSharedValue} from 'react-native-reanimated'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'

import {crop} from './commons/utils/crop'
import {useSizeVector} from './commons/hooks/useSizeVector'
import {getCropRotatedSize} from './commons/utils/getCropRotatedSize'
import {usePanCommons} from './commons/hooks/usePanCommons'
import {usePinchCommons} from './commons/hooks/usePinchCommons'
import {getMaxScale} from './commons/utils/getMaxScale'
import {useVector} from './commons/hooks/useVector'

import type {BoundsFuction, SizeVector} from './types'

const RAD2DEG = 180 / Math.PI

export type CropContextResult = {
  crop: {
    originX: number
    originY: number
    width: number
    height: number
  }
  context: {
    rotationAngle: number
    flipVertical: boolean
    flipHorizontal: boolean
  }
  resize?: SizeVector<number>
}

export type CropZoomRefType = {
  crop: (fixedWidth?: number) => CropContextResult
}

type CropZoomProps = {
  children: React.ReactNode
  cropSize: SizeVector<number>
  resolution: SizeVector<number>
  panMode?: 'clamp' | 'free' | 'friction'
  minScale?: number
}

const CropZoomInner = (props: CropZoomProps, ref: React.ForwardedRef<CropZoomRefType>) => {
  const {children, cropSize, resolution, panMode = 'free', minScale = 1} = props

  const initialSize = getCropRotatedSize({crop: cropSize, resolution, angle: 0})

  const translate = useVector(0, 0)
  const offset = useVector(0, 0)
  const scale = useSharedValue<number>(minScale)
  const scaleOffset = useSharedValue<number>(minScale)
  const rotation = useSharedValue<number>(0)
  const rotate = useVector(0, 0)

  const rootSize = useSizeVector(0, 0)
  const childSize = useSizeVector(initialSize.width, initialSize.height)

  const maxScale = useDerivedValue(() => {
    return getMaxScale({width: childSize.width.value, height: childSize.height.value}, resolution)
  }, [childSize, resolution])

  const boundsFn: BoundsFuction = (optionalScale) => {
    'worklet'
    const scaleVal = optionalScale ?? scale.value
    const boundX = Math.max(0, childSize.width.value * scaleVal - cropSize.width) / 2
    const boundY = Math.max(0, childSize.height.value * scaleVal - cropSize.height) / 2
    return {x: boundX, y: boundY}
  }

  const measureRootContainer = (e: LayoutChangeEvent) => {
    rootSize.width.set(e.nativeEvent.layout.width)
    rootSize.height.set(e.nativeEvent.layout.height)
  }

  const {gesturesEnabled, onTouchesDown, onTouchesMove, onTouchesUp, onPinchStart, onPinchUpdate, onPinchEnd} =
    usePinchCommons({
      container: childSize,
      translate,
      offset,
      scale,
      scaleOffset,
      minScale,
      maxScale,
      allowPinchPanning: true,
      scaleMode: 'bounce',
      pinchMode: 'free',
      boundFn: boundsFn,
      userCallbacks: {},
    })

  const {onPanStart, onPanChange, onPanEnd} = usePanCommons({
    container: childSize,
    translate,
    offset,
    panMode,
    boundFn: boundsFn,
    userCallbacks: {},
  })

  const pinch = Gesture.Pinch()
    .manualActivation(true)
    .onTouchesDown(onTouchesDown)
    .onTouchesMove(onTouchesMove)
    .onTouchesUp(onTouchesUp)
    .onStart(onPinchStart)
    .onUpdate(onPinchUpdate)
    .onEnd(onPinchEnd)

  const pan = Gesture.Pan()
    .enabled(gesturesEnabled)
    .maxPointers(1)
    .onStart(onPanStart)
    .onChange(onPanChange)
    .onEnd(onPanEnd)

  const detectorStyle = useAnimatedStyle(() => {
    return {
      height: childSize.height.value,
      position: 'absolute',
      transform: [{translateX: translate.x.value}, {translateY: translate.y.value}, {scale: scale.value}],
      width: childSize.width.value,
    }
  }, [childSize, translate, scale])

  const childStyle = useAnimatedStyle(() => {
    return {
      height: childSize.height.value,
      transform: [
        {translateX: translate.x.value},
        {translateY: translate.y.value},
        {scale: scale.value},
        {rotate: `${rotation.value}rad`},
        {rotateX: `${rotate.x.value}rad`},
        {rotateY: `${rotate.y.value}rad`},
      ],
      width: childSize.width.value,
    }
  }, [childSize, translate, scale, rotation, rotate])

  const handleCrop = (fixedWidth?: number): CropContextResult => {
    const result = crop({
      cropSize,
      fixedWidth,
      isRotated: rotation.value * RAD2DEG % 180 !== 0,
      itemSize: {width: childSize.width.value, height: childSize.height.value},
      resolution,
      scale: scale.value,
      translation: {x: translate.x.value, y: translate.y.value},
    })

    return {
      context: {
        flipHorizontal: rotate.y.value === Math.PI,
        flipVertical: rotate.x.value === Math.PI,
        rotationAngle: rotation.value * RAD2DEG,
      },
      crop: result.crop,
      resize: result.resize,
    }
  }

  React.useImperativeHandle(ref, () => ({crop: handleCrop}))

  const rootStyle: ViewStyle = {minHeight: cropSize.height, minWidth: cropSize.width}

  return (
    <View style={[styles.root, rootStyle, styles.center]} onLayout={measureRootContainer}>
      <Animated.View style={childStyle}>{children}</Animated.View>
      <GestureDetector gesture={Gesture.Race(pinch, pan)}>
        <Animated.View style={detectorStyle} />
      </GestureDetector>
    </View>
  )
}

export const CropZoom = React.forwardRef<CropZoomRefType, CropZoomProps>(CropZoomInner)

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    flex: 1,
  },
})
