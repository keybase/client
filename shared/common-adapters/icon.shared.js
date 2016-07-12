// @flow
import {globalColors} from '../styles/style-guide'
import type {IconType} from './icon'
import {iconMeta} from './icon.constants'

export function defaultColor (type: IconType): ?string {
  switch (type) {
    case 'iconfont-proof-broken':
      return globalColors.red
    case 'iconfont-proof-followed':
      return globalColors.green
    case 'iconfont-proof-new':
      return globalColors.blue2
    case 'iconfont-close':
      return globalColors.black_20
    default:
      return null
  }
}

export function defaultHoverColor (type: IconType): ?string {
  switch (type) {
    case 'iconfont-proof-new':
    case 'iconfont-proof-followed':
    case 'iconfont-proof-broken':
      return defaultColor(type)
    case 'iconfont-close':
      return globalColors.black_60
    default:
      return null
  }
}

// Some types are the same underlying icon.
export function typeToIconMapper (type: IconType): IconType {
  switch (type) {
    case 'iconfont-proof-new':
    case 'iconfont-proof-followed':
      return 'iconfont-proof-good'
    default:
      return type
  }
}

export function typeExtension (type: IconType): string {
  return iconMeta[type].extension || 'png'
}

export function fontSize (type: IconType): ?Object {
  const fontSize: ?number = iconMeta[type].gridSize

  if (fontSize) {
    return {fontSize}
  } else {
    return null
  }
}
