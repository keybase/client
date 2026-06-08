import type {SizeVector} from '../../types'

export const getMaxScale = (canvasSize: SizeVector<number>, resolution: SizeVector<number>): number => {
  'worklet'
  if (resolution.width > resolution.height) {
    return Math.max(1, resolution.width / canvasSize.width)
  }
  return Math.max(1, resolution.height / canvasSize.height)
}
