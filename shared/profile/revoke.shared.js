/* @flow */

import {capitalize} from 'lodash'
import type {PlatformsExpandedType} from '../constants/types/more'

export function formatMessage (platform: PlatformsExpandedType) {
  const prefix = 'Are you sure you want to revoke your'
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

