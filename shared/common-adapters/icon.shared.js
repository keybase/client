// @flow
import {globalColors} from '../styles/style-guide'
import type {Props} from './icon'

export function defaultColor (type: Props.type): ?string {
  switch (type) {
    case 'fa-custom-icon-proof-broken':
      return globalColors.red
    case 'fa-custom-icon-proof-good-followed':
      return globalColors.green
    case 'fa-custom-icon-proof-good-new':
      return globalColors.blue2
    case 'fa-close':
      return globalColors.black_20
    default:
      return null
  }
}

export function defaultHoverColor (type: Props.type): ?string {
  switch (type) {
    case 'fa-custom-icon-proof-broken':
    case 'fa-custom-icon-proof-good-followed':
    case 'fa-custom-icon-proof-good-new':
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
    case 'fa-custom-icon-proof-good-followed':
    case 'fa-custom-icon-proof-good-new':
      return 'fa-custom-icon-proof-good'
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
