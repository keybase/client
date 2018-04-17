// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {Box, Text, Icon, Button} from '../../common-adapters'
import {fileUIName} from '../../constants/platform'
import {globalStyles, globalMargins, globalColors} from '../../styles'

type Props = {
  kbfsEnabled: boolean,
  inProgress: boolean,
  showBanner: boolean,
  path?: Types.Path,
  onDismiss?: () => void,
  onInstall: () => void,
  onUninstall: () => void,
  openInFileUI?: () => void,
}

const Banner = ({kbfsEnabled, showBanner, onInstall, onUninstall, onDismiss, openInFileUI}: Props) => {
  if (kbfsEnabled && !showBanner) {
    return null
  }
  const iconType = kbfsEnabled ? 'icon-fancy-finder-enabled-132-96' : 'icon-fancy-finder-132-96'
  const bannerStyle = {
    ...globalStyles.flexBoxRow,
    backgroundColor: kbfsEnabled ? globalColors.green : globalColors.blue,
    height: 176,
    alignItems: 'center',
    position: 'relative',
  }
  let bannerContent
  if (kbfsEnabled) {
    bannerContent = (
      <Box style={globalStyles.flexBoxColumn}>
        <Text type="Header" style={textStyle}>
          {onDismiss && 'Yay! '}Keybase is {onDismiss && 'now '}enabled in your {fileUIName}.
        </Text>
        {openInFileUI && (
          <Box style={{justifyContent: 'flex-start'}}>
            <Button type="Primary" label="Open folder" onClick={openInFileUI} />
          </Box>
        )}
      </Box>
    )
  } else {
    bannerContent = (
      <Box style={globalStyles.flexBoxColumn}>
        <Text type="Header" style={textStyle}>
          Enable Keybase in {fileUIName}?
        </Text>
        <Text type="BodySemibold" style={textStyle}>
          Get access to your files and folders just like you normally do with your local files. It's encrypted
          and secure.
        </Text>
        <Box style={{justifyContent: 'flex-start'}}>
          <Button type="PrimaryGreen" label="Yes, enable" onClick={onInstall} />
        </Box>
      </Box>
    )
  }
  return (
    <Box style={bannerStyle}>
      <Box style={bannerIconStyle}>
        <Icon type={iconType} />
      </Box>
      <Box style={bannerTextContentStyle}>{bannerContent}</Box>
      {!!onDismiss && (
        <Box style={dismissContainerStyle}>
          <Icon type="iconfont-close" onClick={onDismiss} color={globalColors.white_40} fontSize={16} />
        </Box>
      )}
    </Box>
  )
}

const sidePadding = globalMargins.large + globalMargins.tiny
const bannerIconStyle = {
  paddingLeft: sidePadding,
  paddingRight: sidePadding,
  paddingTop: globalMargins.large,
  paddingBottom: globalMargins.medium,
}

const bannerTextContentStyle = {
  alignItems: 'center',
  paddingRight: globalMargins.xlarge + globalMargins.medium,
}

const textStyle = {
  color: globalColors.white,
  paddingBottom: globalMargins.small,
}

const dismissContainerStyle = {
  position: 'absolute',
  top: 0,
  right: 0,
  paddingTop: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}
export default Banner
