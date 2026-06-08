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
