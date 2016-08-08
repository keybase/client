/* @flow */

import React from 'react'
import {Box, Text, Icon, Button, PlatformIcon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import {formatMessage} from './revoke.shared'
import {subtitle as platformSubtitle} from '../util/platforms'

import type {Props} from './revoke'

const Render = ({platform, platformHandle, errorMessage, onCancel, onRevoke, isWaiting}: Props) => {
  const platformHandleSubtitle = platformSubtitle(platform)

  return (
    <Box style={styleContainer}>
      {!isWaiting && <Icon style={styleClose} type='iconfont-close' onClick={() => onCancel()} />}
      {errorMessage && <Box style={styleErrorBanner}><Text style={styleErrorBannerText} type='BodySmallSemibold'>{errorMessage}</Text></Box>}
      <Box style={styleContentContainer}>
        <PlatformIcon platform={platform} overlay={'icon-proof-broken'} overlayColor={globalColors.red} size={48} />
        <Text style={stylePlatformUsername} type='Header'>{platformHandle}</Text>
        {!!platformHandleSubtitle && <Text style={stylePlatformSubtitle} type='Body'>{platformHandleSubtitle}</Text>}
        <Text style={styleDescriptionText} type='Header'>{formatMessage(platform)}</Text>
        <Text style={styleReminderText} type='Body'>You can add it again later, if you change your mind.</Text>
        <Box style={styleButtonsContainer}>
          <Button type='Secondary' onClick={onCancel} label='Cancel' disabled={isWaiting} />
          <Button type='Danger' onClick={onRevoke} label='Yes, revoke it' waiting={isWaiting} />
        </Box>
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  alignItems: 'center',
  position: 'relative',
  paddingTop: globalMargins.large,
  paddingBottom: globalMargins.large,
  ...globalStyles.scrollable,
}

const styleClose = {
  position: 'absolute',
  top: globalMargins.small,
  right: globalMargins.small,
  ...globalStyles.clickable,
  color: globalColors.black_10,
}

const styleErrorBanner = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  zIndex: 1,
  minHeight: globalMargins.large,
  padding: globalMargins.tiny,
  marginTop: -globalMargins.large,
  backgroundColor: globalColors.red,
}

const styleErrorBannerText = {
  color: globalColors.white,
  maxWidth: 512,
  textAlign: 'center',
}

const styleContentContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  margin: globalMargins.large,
  maxWidth: 512,
  textAlign: 'center',
}

const stylePlatformUsername = {
  ...globalStyles.textDecoration('line-through'),
  color: globalColors.red,
}

const stylePlatformSubtitle = {
  color: globalColors.black_10,
}

const styleDescriptionText = {
  marginTop: globalMargins.medium,
  textAlign: 'center',
}

const styleReminderText = {
  marginTop: globalMargins.tiny,
  textAlign: 'center',
}

const styleButtonsContainer = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.medium,
}

export default Render
