// @flow
import * as React from 'react'
import {Box, Text, Button, PlatformIcon, StandardScreen, ButtonBar} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {propsForPlatform} from './shared'

import type {Props} from '.'

const Render = (props: Props) => {
  const {platform, onReloadProfile, username, platformIconOverlayColor} = props
  const {platformIconOverlay, usernameSubtitle, message, messageSubtitle} = propsForPlatform(props)

  return (
    <Box style={globalStyles.flexBoxColumn}>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          paddingBottom: globalMargins.medium,
          paddingLeft: globalMargins.medium,
          paddingRight: globalMargins.medium,
        }}
      >
        <PlatformIcon
          platform={platform}
          overlay={platformIconOverlay}
          overlayColor={platformIconOverlayColor}
        />
        <Text type="Header" style={{color: globalColors.blue}}>
          {username}
        </Text>
        {!!usernameSubtitle && (
          <Text type="Body" style={{color: globalColors.black_20, paddingBottom: globalMargins.large}}>
            {usernameSubtitle}
          </Text>
        )}
        <Text
          center={true}
          type="Body"
          style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.small}}
        >
          {message}
        </Text>
        {!!messageSubtitle && (
          <Text center={true} type="BodySmall">
            {messageSubtitle}
          </Text>
        )}
      </Box>
      <ButtonBar>
        <Button type="Primary" onClick={onReloadProfile} label="Reload profile" />
      </ButtonBar>
    </Box>
  )
}

const Wrapped = (props: Props) => {
  const {title} = propsForPlatform(props)
  const {titleColor, onReloadProfile} = props

  const notification = (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: titleColor,
        height: globalMargins.large,
        justifyContent: 'center',
      }}
    >
      <Text backgroundMode="Terminal" type="BodySemibold">
        {title}
      </Text>
    </Box>
  )
  return (
    <StandardScreen
      onBack={onReloadProfile}
      styleBanner={{backgroundColor: titleColor}}
      notification={{message: notification, type: 'success'}}
    >
      <Render {...props} />
    </StandardScreen>
  )
}

export default Wrapped
