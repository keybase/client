// @flow

import type {AvatarSize} from './avatar'
import type {IconType} from './icon'

export function avatarPlaceholder (size: AvatarSize): IconType {
  switch (size) {
    case 176:
      return 'icon-placeholder-avatar-176-x-176'
    case 112:
      return 'icon-placeholder-avatar-112-x-112'
    case 80:
      return 'icon-placeholder-avatar-80-x-80'
    case 64:
      return 'icon-placeholder-avatar-64-x-64'
    case 48:
      return 'icon-placeholder-avatar-48-x-48'
    case 32:
      return 'icon-placeholder-avatar-32-x-32'
    case 24:
      return 'icon-placeholder-avatar-24-x-24'
  }

  return 'icon-placeholder-avatar-32-x-32'
}

export function followsMeIcon (size: AvatarSize): ?IconType {
  switch (size) {
    case 176:
      return 'icon-follow-me-32'
    case 112:
      return 'icon-follow-me-28'
    case 80:
    case 64:
    case 48:
      return 'icon-follow-me-21'
  }

  return null
}

export function followingIcon (size: AvatarSize): IconType {
  switch (size) {
    case 176:
      return 'icon-following-32'
    case 112:
      return 'icon-following-28'
    case 80:
    case 64:
    case 48:
      return 'icon-following-21'
  }

  return null
}

export function mutualFollowingIcon (size: AvatarSize): IconType {
  switch (size) {
    case 176:
      return 'icon-mutual-follow-32'
    case 112:
      return 'icon-mutual-follow-28'
    case 80:
    case 64:
    case 48:
      return 'icon-mutual-follow-21'
  }

  return null
}

export function createAvatarUrl (props: {url: ?string} | {username: ?string}): ?string {
  if (__SCREENSHOT__) return null
  if (props.url) return props.url
  if (props.username) return `https://keybase.io/${props.username}/picture`
  return null
}
