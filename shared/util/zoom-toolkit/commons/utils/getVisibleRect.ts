import type {SizeVector, Vector, Rect} from '../../types'

type Options = {
  scale: number
  translation: Vector<number>
  itemSize: SizeVector<number>
  containerSize: SizeVector<number>
}

export const getVisibleRect = (options: Options): Rect => {
  'worklet'
  const {scale, translation, itemSize, containerSize} = options

  const offsetX = (itemSize.width * scale - containerSize.width) / 2
  const offsetY = (itemSize.height * scale - containerSize.height) / 2
  const clampedX = Math.max(offsetX, 0)
  const clampedY = Math.max(offsetY, 0)

  const reducerX = (-1 * translation.x + clampedX) / (itemSize.width * scale)
  const reducerY = (-1 * translation.y + clampedY) / (itemSize.height * scale)

  const x = itemSize.width * reducerX
  const y = itemSize.height * reducerY
  const width = itemSize.width * Math.min(1, containerSize.width / (itemSize.width * scale))
  const height = itemSize.height * Math.min(1, containerSize.height / (itemSize.height * scale))

  return {x, y, width, height}
}
