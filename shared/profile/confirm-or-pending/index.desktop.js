// @flow
import * as React from 'react'
import {Box, Text, Button, PlatformIcon} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {propsForPlatform} from './shared'

import type {Props} from '.'

const Render = (props: Props) => {
  const {platform, onReloadProfile, titleColor, username, platformIconOverlayColor} = props
  const {title, platformIconOverlay, usernameSubtitle, message, messageSubtitle} = propsForPlatform(props)

  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          backgroundColor: titleColor,
          height: globalMargins.large,
          justifyContent: 'center',
        }}
      >
        <Text backgroundMode="Success" type="BodySemibold">
          {title}
        </Text>
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', padding: globalMargins.large}}>
        <PlatformIcon
          platform={platform}
          overlay={platformIconOverlay}
          overlayColor={platformIconOverlayColor}
        />
        <Text type="Header" style={stylePlatformUsername}>
          {username}
        </Text>
        {!!usernameSubtitle && (
          <Text type="Body" style={{color: globalColors.black_20}}>
            {usernameSubtitle}
          </Text>
        )}
        <Text center={true} type="Body" style={{marginTop: globalMargins.large, maxWidth: 560}}>
          {message}
        </Text>
        {!!messageSubtitle && (
          <Text center={true} type="BodySmall">
            {messageSubtitle}
          </Text>
        )}
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

const stylePlatformUsername = platformStyles({
  common: {
    color: globalColors.blue,
    maxWidth: 400,
  },
  isElectron: {
    overflowWrap: 'break-word',
  },
})

export default Render
