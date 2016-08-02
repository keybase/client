/* @flow */

import React from 'react'
import type {Props} from './confirm-or-pending'
import {Box, Text, Button, PlatformIcon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {propsForPlatform} from './confirm-or-pending.shared'

const Render = (props: Props) => {
  const {platform, onReloadProfile, titleColor, username, platformIconOverlayColor} = props
  const {
    title, platformIconOverlay, usernameSubtitle, message, messageSubtitle,
  } = propsForPlatform(props)

  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Box style={{...globalStyles.flexBoxColumn, justifyContent: 'center', alignItems: 'center', backgroundColor: titleColor, height: globalMargins.large}}>
        <Text backgroundMode='Terminal' type='BodySmallSemibold'>{title}</Text>
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', padding: globalMargins.large}}>
        <PlatformIcon platform={platform} overlay={platformIconOverlay} overlayColor={platformIconOverlayColor} size={48} />
        <Text type='Header' style={{color: globalColors.blue}}>{username}</Text>
        {!!usernameSubtitle && <Text type='Body' style={{color: globalColors.black_10}}>{usernameSubtitle}</Text>}
        <Text type='Body' style={{marginTop: globalMargins.xlarge, textAlign: 'center'}}>{message}</Text>
        {!!messageSubtitle && <Text type='BodySmall' style={{textAlign: 'center'}}>{messageSubtitle}</Text>}
        <Button type='Primary' onClick={onReloadProfile} label='Reload profile' style={{marginTop: globalMargins.medium}} />
      </Box>
    </Box>
  )
}

export default Render
