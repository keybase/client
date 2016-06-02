// @flow
import type {Props} from './avatar'

export function createAvatarUrl (props: {url: ?string} | {username: ?string}): ?string {
    if (props.url) {
      return props.url
    } else if (props.username) {
      return `https://keybase.io/${props.username}/picture`
    }
    return null
}
