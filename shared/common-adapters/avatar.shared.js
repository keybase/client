// @flow
import {isTesting} from '../local-debug'
import type {AvatarSize} from './avatar'

export function createAvatarUrl (props: {url: ?string} | {username: ?string, size: AvatarSize}): ?string {
  if (__SCREENSHOT__ || isTesting) return null
  if (props.url) return props.url
  if (props.username) {
    const formatSize = {
      '176': 200,
      '112': 200,
      '80': 200,
      '64': 200,
      '48': 200,
      '32': 40,
      '24': 40,
      '16': 40,
    }[String(props.size || '')]

    // from config/image.iced
    const format = {
      '40': '?format=square_40',
      '200': '?format=square_200',
      '360': '?format=square_360',
    }[String(formatSize)]

    return `https://keybase.io/${props.username || ''}/picture${format}`
  }
  return null
}
