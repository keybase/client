import Mousetrap from 'mousetrap'

export const bind = (
  keys: Array<string> | string,
  cb: (e: {stopPropagation: () => void}, key: string) => void,
  type: 'keydown'
) => Mousetrap.bind(keys, cb, type)
export const unbind = (keys: Array<string> | string) => Mousetrap.unbind(keys)
