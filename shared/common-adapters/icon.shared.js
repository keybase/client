// @flow
import {globalColors} from '../styles/style-guide'
import type {Props} from './icon'

export function defaultColor (type: Props.type): ?string {
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

export function defaultHoverColor (type: Props.type): ?string {
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
export function typeToIconMapper (type: Props.type): Props.type {
  switch (type) {
    case 'fa-kb-iconfont-proof-new':
    case 'fa-kb-iconfont-proof-followed':
      return 'fa-kb-iconfont-proof-good'
    default:
      return type
  }
}

export function typeExtension (type: Props.type): string {
  switch (type) {
    case 'progress-white':
    case 'progress-grey':
      return 'gif'
    default:
      return 'png'
  }
}
