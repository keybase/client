import {getVisibleRect} from './getVisibleRect'
import type {SizeVector, Vector} from '../../types'

type CanvasToSizeOptions = {
  scale: number
  cropSize: SizeVector<number>
  itemSize: SizeVector<number>
  resolution: SizeVector<number>
  translation: Vector<number>
  isRotated: boolean
  fixedWidth?: number
}

export const crop = (options: CanvasToSizeOptions) => {
  'worklet'
  const {cropSize, itemSize, resolution, translation, scale, isRotated, fixedWidth} = options

  const rect = getVisibleRect({
    scale,
    containerSize: cropSize,
    itemSize: {
      width: isRotated ? itemSize.height : itemSize.width,
      height: isRotated ? itemSize.width : itemSize.height,
    },
    translation,
  })

  const relativeScale = resolution.width / itemSize.width
  const x = rect.x * relativeScale
  const y = rect.y * relativeScale
  const width = rect.width * relativeScale
  const height = rect.height * relativeScale

  let sizeModifier = 1
  let resize: SizeVector<number> | undefined
  if (fixedWidth !== undefined) {
    sizeModifier = fixedWidth / width
    resize = {
      width: Math.ceil(resolution.width * sizeModifier),
      height: Math.ceil(resolution.height * sizeModifier),
    }
  }

  return {
    crop: {
      originX: x * sizeModifier,
      originY: y * sizeModifier,
      width: Math.floor(width * sizeModifier),
      height: Math.floor(height * sizeModifier),
    },
    resize,
  }
}
