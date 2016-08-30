/* @flow */

import React from 'react'
import {Box, Text, Button, PlatformIcon, StandardScreen} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {propsForPlatform} from './confirm-or-pending.shared'

import type {Props} from './confirm-or-pending'

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
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', paddingTop: globalMargins.xlarge, paddingBottom: globalMargins.medium, paddingLeft: globalMargins.medium, paddingRight: globalMargins.medium}}>
        <PlatformIcon platform={platform} overlay={platformIconOverlay} overlayColor={platformIconOverlayColor} />
        <Text type='Header' style={{color: globalColors.blue}}>{username}</Text>
        {!!usernameSubtitle && <Text type='Body' style={{color: globalColors.black_10, paddingBottom: globalMargins.large}}>{usernameSubtitle}</Text>}
        <Text type='Body' style={{marginTop: globalMargins.small, textAlign: 'center'}}>{message}</Text>
        {!!messageSubtitle && <Text type='BodySmall' style={{textAlign: 'center'}}>{messageSubtitle}</Text>}
      </Box>
      <Box style={{...globalStyles.flexBoxRow, paddingLeft: globalMargins.small, paddingRight: globalMargins.small}}>
        <Button type='Primary' onClick={onReloadProfile} label='Reload profile' style={{flex: 1}} />
      </Box>
    </Box>
  )
}

const Wrapped = (props: Props) => {
  return <StandardScreen styleOuter={{padding: 0, paddingTop: globalMargins.small}}><Render {...props} /></StandardScreen>
}

export default Wrapped
