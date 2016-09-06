// @flow
import {isTesting} from '../local-debug'

export function createAvatarUrl (props: {url: ?string} | {username: ?string}): ?string {
  if (__SCREENSHOT__ || isTesting) return null
  if (typeof props.url === 'string') return props.url
  if (typeof props.username === 'string') return `https://keybase.io/${props.username}/picture`
  return null
}
