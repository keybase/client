// @flow
import React from 'react'
import {Box, Text, Button, PlatformIcon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import {propsForPlatform} from './confirm-or-pending.shared'

import type {Props} from './confirm-or-pending'

const Render = (props: Props) => {
  const {platform, onReloadProfile, titleColor, username, platformIconOverlayColor} = props
  const {title, platformIconOverlay, usernameSubtitle, message, messageSubtitle} = propsForPlatform(
    props
  )

  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: titleColor,
          height: globalMargins.large,
        }}
      >
        <Text backgroundMode="Success" type="BodySemibold">{title}</Text>
      </Box>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          padding: globalMargins.large,
        }}
      >
        <PlatformIcon
          platform={platform}
          overlay={platformIconOverlay}
          overlayColor={platformIconOverlayColor}
        />
        <Text type="Header" style={{color: globalColors.blue}}>{username}</Text>
        {!!usernameSubtitle &&
          <Text type="Body" style={{color: globalColors.black_20}}>
            {usernameSubtitle}
          </Text>}
        <Text
          type="Body"
          style={{
            marginTop: globalMargins.large,
            textAlign: 'center',
            maxWidth: 560,
          }}
        >
          {message}
        </Text>
        {!!messageSubtitle &&
          <Text type="BodySmall" style={{textAlign: 'center'}}>
            {messageSubtitle}
          </Text>}
        <Button
          type="Primary"
          onClick={onReloadProfile}
          label="Reload profile"
          style={{marginTop: globalMargins.medium}}
        />
      </Box>
    </Box>
  )
}

export default Render
