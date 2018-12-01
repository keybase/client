// @flow
import * as React from 'react'
import {Box, Text, Icon, Button, PlatformIcon, ButtonBar} from '../../common-adapters'
import {
  globalStyles,
  globalColors,
  globalMargins,
  isMobile,
  desktopStyles,
  platformStyles,
  collapseStyles,
} from '../../styles'
import {formatMessage, formatConfirmButton} from './index.shared'
import {subtitle as platformSubtitle} from '../../util/platforms'

import type {Props} from './index'

const Revoke = ({platform, platformHandle, errorMessage, onCancel, onRevoke, isWaiting}: Props) => {
  const platformHandleSubtitle = platformSubtitle(platform)

  return (
    <Box style={styleContainer}>
      {!isWaiting && (
        <Icon
          style={styleClose}
          type="iconfont-close"
          onClick={() => onCancel()}
          color={globalColors.black_10}
        />
      )}
      {errorMessage && (
        <Box style={styleErrorBanner}>
          <Text style={styleErrorBannerText} type="BodySemibold">
            {errorMessage}
          </Text>
        </Box>
      )}
      <Box style={styleContentContainer}>
        <PlatformIcon platform={platform} overlay={'icon-proof-broken'} overlayColor={globalColors.red} />
        <Text style={stylePlatformUsername} type="Header">
          {platformHandle}
        </Text>
        {!!platformHandleSubtitle && (
          <Text style={stylePlatformSubtitle} type="Body">
            {platformHandleSubtitle}
          </Text>
        )}
        <Text style={styleDescriptionText} type="Header">
          {formatMessage(platform)}
        </Text>
        <Text style={styleReminderText} type="Body">
          You can add it again later, if you change your mind.
        </Text>
        <ButtonBar>
          <Button type="Secondary" onClick={onCancel} label="Cancel" disabled={isWaiting} />
          <Button
            type="Danger"
            onClick={onRevoke}
            label={formatConfirmButton(platform)}
            waiting={isWaiting}
          />
        </ButtonBar>
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flexGrow: 1,
  paddingBottom: globalMargins.large,
  paddingTop: globalMargins.large,
  position: 'relative',
  ...desktopStyles.scrollable,
}

const styleClose = collapseStyles([
  {
    position: 'absolute',
    right: globalMargins.small,
    top: globalMargins.small,
  },
  desktopStyles.clickable,
])

const styleErrorBanner = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.red,
  justifyContent: 'center',
  minHeight: globalMargins.large,
  padding: globalMargins.tiny,
  width: '100%',
  zIndex: 1,
}

const styleErrorBannerText = {
  color: globalColors.white,
  maxWidth: 512,
  ...(isMobile ? {} : {textAlign: 'center'}),
}

const styleContentContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flexGrow: 1,
  justifyContent: 'center',
  margin: globalMargins.large,
  maxWidth: 512,
  ...(isMobile ? {} : {textAlign: 'center'}),
}

const stylePlatformUsername = platformStyles({
  common: {
    color: globalColors.red,
    textDecorationLine: 'line-through',
  },
  isElectron: {
    maxWidth: 400,
    overflowWrap: 'break-word',
    textAlign: 'center',
  },
})
const stylePlatformSubtitle = {
  color: globalColors.black_20,
}

const styleDescriptionText = {
  marginTop: globalMargins.medium,
  ...(isMobile ? {} : {textAlign: 'center'}),
}

const styleReminderText = {
  marginTop: globalMargins.tiny,
  ...(isMobile ? {} : {textAlign: 'center'}),
}

export default Revoke
