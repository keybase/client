// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import {Box, Text, Icon, Button} from '../../../common-adapters'
import {fileUIName} from '../../../constants/platform'
import * as Styles from '../../../styles'

type Props = {
  kbfsEnabled: boolean,
  kbfsOutdated?: boolean,
  inProgress: boolean,
  path?: Types.Path,
  onDismiss?: () => void,
  onInstall: () => void,
  openInSystemFileManager?: () => void,
  dokanUninstall?: () => void,
}

const Banner = ({
  kbfsEnabled,
  kbfsOutdated,
  onInstall,
  onDismiss,
  openInSystemFileManager,
  dokanUninstall,
}: Props) => {
  const promptText = kbfsOutdated
    ? dokanUninstall
      ? 'A newer version of Dokan is available. It is reccomended that the current version be uninstalled before installing this update.'
      : 'A newer version of Dokan is available. Please remove the old version before installing it.'
    : `Get access to your files and folders just like you normally do with your local files. It's encrypted and secure.`
  const buttonText = dokanUninstall ? 'Yes, uninstall' : 'Yes, enable'
  let bannerContent
  if (kbfsEnabled) {
    bannerContent = (
      <Box style={Styles.globalStyles.flexBoxColumn}>
        <Text type="Header" style={styles.text}>
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
      <Box style={Styles.globalStyles.flexBoxColumn}>
        <Text type="Header" style={styles.text}>
          Enable Keybase in {fileUIName}?
        </Text>
        <Text type="BodySemibold" style={styles.text}>
          {promptText}
        </Text>
        <Box style={{justifyContent: 'flex-start'}}>
          <Button type="PrimaryGreen" label={buttonText} onClick={dokanUninstall || onInstall} />
        </Box>
      </Box>
    )
  }
  return (
    <Box
      style={Styles.collapseStyles([
        styles.banner,
        {
          backgroundColor: kbfsEnabled ? Styles.globalColors.green : Styles.globalColors.blue,
        },
      ])}
    >
      <Box style={styles.bannerIcon}>
        <Icon type={kbfsEnabled ? 'icon-fancy-finder-enabled-132-96' : 'icon-fancy-finder-132-96'} />
      </Box>
      <Box style={styles.bannerTextContent}>{bannerContent}</Box>
      {!!onDismiss && (
        <Box style={styles.dismissContainer}>
          <Icon
            type="iconfont-close"
            onClick={onDismiss}
            color={Styles.globalColors.white_40}
            fontSize={16}
          />
        </Box>
      )}
    </Box>
  )
}

export const height = 176

const sidePadding = Styles.globalMargins.large + Styles.globalMargins.tiny
const styles = Styles.styleSheetCreate({
  banner: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height,
    maxHeight: height,
    minHeight: height,
    position: 'relative',
  },
  bannerIcon: {
    paddingBottom: Styles.globalMargins.medium,
    paddingLeft: sidePadding,
    paddingRight: sidePadding,
    paddingTop: Styles.globalMargins.large,
  },
  bannerTextContent: {
    alignItems: 'center',
    paddingRight: Styles.globalMargins.xlarge + Styles.globalMargins.medium,
  },
  dismissContainer: {
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  text: {
    color: Styles.globalColors.white,
    paddingBottom: Styles.globalMargins.small,
  },
})

export default Banner
