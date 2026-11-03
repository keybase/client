import type * as T from '@/constants/types'

export const fixCrop = (c?: T.RPCChat.Keybase1.ImageCropRect) => {
  return c
    ? {
        x0: Math.floor(c.x0),
        x1: Math.floor(c.x1),
        y0: Math.floor(c.y0),
        y1: Math.floor(c.y1),
      }
    : undefined
}

// A desktop drag-pan view of an image: the image's rendered size at `scale`, and the offset of the
// view's top-left corner into it.
export type CropView = {
  height: number
  width: number
  x: number
  y: number
  scale: number
}

// The square of the source image a `windowSize` view shows.
export const cropViewToRect = (c: CropView, windowSize: number) => {
  const {x, y, scale, width, height} = c
  const maxX = width / scale
  const maxY = height / scale
  const windowScaled = Math.round(windowSize / scale)
  let x0 = x / scale
  x0 = Math.min(Math.max(Math.round(x0), 0), maxX)
  const x1 = Math.min(x0 + windowScaled, maxX)
  let y0 = y / scale
  y0 = Math.min(Math.max(Math.round(y0), 0), maxY)
  const y1 = Math.min(y0 + windowScaled, maxY)
  return {x0, x1, y0, y1}
}
