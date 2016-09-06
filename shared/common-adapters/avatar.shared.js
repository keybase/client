// @flow
import {isTesting} from '../local-debug'

export function createAvatarUrl (props: {url: ?string} | {username: ?string}): ?string {
  if (__SCREENSHOT__ || isTesting) return null
  if (props.url) return props.url
  if (props.username) return `https://keybase.io/${props.username}/picture`
  return null
}
