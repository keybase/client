// @flow
import {globalColors} from '../styles/style-guide'
import type {IconType} from './icon'
import _ from 'lodash'
import iconFontSize from './icon.font.size'

export function defaultColor (type: IconType): ?string {
  switch (type) {
    case 'fa-kb-iconfont-proof-broken':
      return globalColors.red
    case 'fa-kb-iconfont-proof-followed':
      return globalColors.green
    case 'fa-kb-iconfont-proof-new':
      return globalColors.blue2
    case 'fa-close':
      return globalColors.black_20
    default:
      return null
  }
}

export function defaultHoverColor (type: IconType): ?string {
  switch (type) {
    case 'fa-kb-iconfont-proof-new':
    case 'fa-kb-iconfont-proof-followed':
    case 'fa-kb-iconfont-proof-broken':
      return defaultColor(type)
    case 'fa-close':
      return globalColors.black_60
    default:
      return null
  }
}

// Some types are the same underlying icon.
export function typeToIconMapper (type: IconType): IconType {
  switch (type) {
    case 'fa-kb-iconfont-proof-new':
    case 'fa-kb-iconfont-proof-followed':
      return 'fa-kb-iconfont-proof-good'
    default:
      return type
  }
}

export function typeExtension (type: IconType): string {
  return _.endsWith(type, '-animated') ? 'gif' : 'png'
}

export function fontSize (type: IconType): ?Object {
  const fontSize: ?number = iconFontSize[type]

  if (fontSize) {
    return {fontSize}
  } else {
    return null
  }
}
