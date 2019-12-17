import * as Rect from 'react'

export const bind: (
  keys: Array<string> | string,
  cb: (e: React.BaseSyntheticEvent, key: string) => void,
  type: 'keydown'
) => void
export const unbind: (keys: Array<string> | string) => void
