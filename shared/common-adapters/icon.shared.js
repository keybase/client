// @flow
import {globalColors} from '../styles'
import type {IconType} from './icon'
import {iconMeta} from './icon.constants'

export function defaultColor(type: IconType): ?string {
  switch (type) {
    case 'iconfont-proof-broken':
      return globalColors.red
    case 'iconfont-proof-pending':
      return globalColors.black_40
    case 'iconfont-close':
      return globalColors.black_20
    default:
      return null
  }
}

export function defaultHoverColor(type: IconType): ?string {
  switch (type) {
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
export function typeToIconMapper(type: IconType): IconType {
  switch (type) {
    case 'icon-progress-white-animated':
      return __SCREENSHOT__ ? 'icon-progress-white-static' : 'icon-progress-white-animated'
    case 'icon-progress-grey-animated':
      return __SCREENSHOT__ ? 'icon-progress-grey-static' : 'icon-progress-grey-animated'
    case 'icon-loader-infinity-64':
      return __SCREENSHOT__ ? 'icon-loader-infinity-static-64' : 'icon-loader-infinity-64'
    case 'icon-loader-infinity-80':
      return __SCREENSHOT__ ? 'icon-loader-infinity-static-80' : 'icon-loader-infinity-80'
    case 'icon-facebook-visibility':
      return __SCREENSHOT__ ? 'icon-facebook-visibility-static' : 'icon-facebook-visibility'
    case 'icon-secure-266':
      return __SCREENSHOT__ ? 'icon-secure-static-266' : 'icon-secure-266'
    case 'icon-securing-266':
      return __SCREENSHOT__ ? 'icon-securing-static-266' : 'icon-securing-266'
    case 'icon-loader-uploading-16':
      return __SCREENSHOT__ ? 'icon-loader-uploading-16-static' : 'icon-loader-uploading-16'
    default:
      return type
  }
}

export function typeExtension(type: IconType): string {
  return iconMeta[type].extension || 'png'
}

export function fontSize(type: IconType): ?Object {
  const fontSize: ?number = iconMeta[type].gridSize

  if (fontSize) {
    return {fontSize}
  } else {
    return null
  }
}
