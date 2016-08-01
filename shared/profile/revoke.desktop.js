/* @flow */

import React from 'react'
import {Box, Text, Button, PlatformIcon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {formatMessage} from './revoke.shared'
import {subtitle as platformSubtitle} from '../util/platforms'

import type {Props} from './revoke'

const Render = ({platform, platformHandle, isHttps, onCancel, onRevoke}: Props) => {
  const platformHandleSubtitle = platformSubtitle(platform, isHttps)

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
