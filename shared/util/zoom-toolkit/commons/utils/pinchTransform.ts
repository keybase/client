import type {Vector} from '../../types'

type PinchOptions = {
  toScale: number
  fromScale: number
  origin: Vector<number>
  delta: Vector<number>
  offset: Vector<number>
}

export const pinchTransform = (options: PinchOptions): Vector<number> => {
  'worklet'
  const {toScale, fromScale, delta, origin, offset} = options

  const fromPinchX = -1 * (origin.x * fromScale - origin.x)
  const fromPinchY = -1 * (origin.y * fromScale - origin.y)
  const toPinchX = -1 * (origin.x * toScale - origin.x)
  const toPinchY = -1 * (origin.y * toScale - origin.y)

  const x = offset.x + toPinchX - fromPinchX + delta.x
  const y = offset.y + toPinchY - fromPinchY + delta.y
  return {x, y}
}
