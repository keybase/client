// @flow
import {capitalize} from 'lodash'
import type {PlatformsExpandedType} from '../../constants/types/more'

function formatMessage(platform: PlatformsExpandedType) {
  let prefix
  switch (platform) {
    case 'pgp':
      prefix = 'Are you sure you want to drop your'
      break
    default:
      prefix = 'Are you sure you want to revoke your'
  }

  let body
  switch (platform) {
    case 'btc':
      body = 'Bitcoin address'
      break
    case 'dns':
    case 'http':
    case 'https':
      body = 'website'
      break
    case 'hackernews':
      body = 'Hacker News identity'
      break
    default:
      body = `${capitalize(platform)} identity`
  }
  return `${prefix} ${body}?`
}

function formatConfirmButton(platform: PlatformsExpandedType) {
  let msg
  switch (platform) {
    case 'pgp':
      msg = 'Yes, drop it'
      break
    default:
      msg = 'Yes, revoke it'
  }
  return msg
}

export {formatMessage, formatConfirmButton}
