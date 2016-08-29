// @flow
import {globalColors} from '../styles'
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
    case 'iconfont-proof-pending':
      return globalColors.black_40
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
    case 'iconfont-proof-pending':
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
    case 'icon-progress-white-animated':
      return __SCREENSHOT__ ? 'icon-progress-white-static' : 'icon-progress-white-animated'
    case 'icon-progress-grey-animated':
      return __SCREENSHOT__ ? 'icon-progress-grey-static' : 'icon-progress-grey-animated'
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
