/* @flow */

import React from 'react'
import {Box, Text, Button, PlatformIcon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {capitalize} from 'lodash'

import type {Props} from './revoke'
import type {Platforms} from '../constants/types/more'

function formatMessage (platform: Platforms | 'btc') {
  const prefix = 'Are you sure you want to revoke your'
  let body
  switch (platform) {
    case 'btc':
      body = 'Bitcoin address'
      break
    case 'dns':
    case 'genericWebSite':
      body = 'website'
      break
    default:
      body = capitalize(platform)
  }
  return `${prefix} ${body}?`
}

function formatSubtext (platform: Platforms | 'btc', isHttps: boolean) {
  switch (platform) {
    case 'btc':
      return ''
    case 'dns':
      return 'dns'
    case 'genericWebSite':
      if (isHttps) {
        return 'https'
      }
      return 'http'
    default:
      return `@${platform}`
  }
}

const Render = ({platform, platformHandle, isHttps, onCancel, onRevoke}: Props) => {
  const platformHandleSubtitle = formatSubtext(platform, isHttps)

  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', padding: globalMargins.large}}>
        <PlatformIcon platform={platform} overlay={'iconfont-proof-broken'} overlayColor={globalColors.red} size={48} />
        <Text type='Header' style={{...globalStyles.textDecoration('line-through'), color: globalColors.red}}>{platformHandle}</Text>
        {!!platformHandleSubtitle && <Text type='Body' style={{color: globalColors.black_10}}>{platformHandleSubtitle}</Text>}
        <Text type='Header' style={{marginTop: globalMargins.medium, textAlign: 'center'}}>{formatMessage(platform)}</Text>
        <Text type='Body' style={{marginTop: globalMargins.tiny, textAlign: 'center'}}>You can add it again later, if you change your mind.</Text>
        <Box style={{...globalStyles.flexBoxRow}}>
          <Button type='Secondary' onClick={onCancel} label='Cancel' style={{marginTop: globalMargins.medium}} />
          <Button type='Danger' onClick={onRevoke} label='Yes, revoke it' style={{marginTop: globalMargins.medium}} />
        </Box>
      </Box>
    </Box>
  )
}

export default Render
