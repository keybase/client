// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import {Box, Text, Icon, Button} from '../../../common-adapters'
import {fileUIName} from '../../../constants/platform'
import {globalStyles, globalMargins, globalColors} from '../../../styles'

type Props = {
  kbfsEnabled: boolean,
  kbfsOutdated?: boolean,
  inProgress: boolean,
  showBanner: boolean,
  path?: Types.Path,
  onDismiss?: () => void,
  onInstall: () => void,
  openInSystemFileManager?: () => void,
  dokanUninstall?: () => void,
}

const Banner = ({
  kbfsEnabled,
  kbfsOutdated,
  showBanner,
  onInstall,
  onDismiss,
  openInSystemFileManager,
  dokanUninstall,
}: Props) => {
  if (!showBanner) {
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
  const promptText = kbfsOutdated
    ? dokanUninstall
      ? 'A newer version of Dokan is available. It is reccomended that the current version be uninstalled before installing this update.'
      : 'A newer version of Dokan is available. Please remove the old version before installing it.'
    : `Get access to your files and folders just like you normally do with your local files. It's encrypted and secure.`
  const buttonText = dokanUninstall ? 'Yes, uninstall' : 'Yes, enable'
  let bannerContent
  if (kbfsEnabled) {
    bannerContent = (
      <Box style={globalStyles.flexBoxColumn}>
        <Text type="Header" style={textStyle}>
          {onDismiss && 'Yay! '}
          Keybase is {onDismiss && 'now '}
          enabled in your {fileUIName}.
        </Text>
        {openInSystemFileManager && (
          <Box style={{justifyContent: 'flex-start'}}>
            <Button type="Primary" label="Open folder" onClick={openInSystemFileManager} />
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
          {promptText}
        </Text>
        <Box style={{justifyContent: 'flex-start'}}>
          <Button type="PrimaryGreen" label={buttonText} onClick={dokanUninstall || onInstall} />
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
